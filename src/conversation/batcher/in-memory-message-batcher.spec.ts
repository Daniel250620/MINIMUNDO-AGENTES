import { DEFAULT_BATCH_QUIET_MS } from './message-batcher';
import { InMemoryMessageBatcher } from './in-memory-message-batcher';
import type { BatchItem } from './message-batcher';

const item = (t: string): BatchItem => ({ msg: { text: t } as any });
const texts = (items: BatchItem[]) => items.map((i) => i.msg.text);

function setup(quiet = 1000) {
  const batcher = new InMemoryMessageBatcher({
    get: () => String(quiet),
  } as any);
  jest.spyOn((batcher as any).logger, 'error').mockImplementation();
  const calls: { id: string; texts: (string | null)[] }[] = [];
  const gates: (() => void)[] = [];
  let active = 0;
  let maxActive = 0;
  let failNext = false;
  batcher.onBatch(async (id, items) => {
    calls.push({ id, texts: texts(items) });
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise<void>((r) => gates.push(r));
    active--;
    if (failNext) {
      failNext = false;
      throw new Error('boom');
    }
  });
  return {
    batcher,
    calls,
    release: async () => {
      gates.shift()?.();
      await jest.advanceTimersByTimeAsync(0);
    },
    fail: () => (failNext = true),
    maxActive: () => maxActive,
  };
}

describe('InMemoryMessageBatcher', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ráfaga de tres mensajes: un solo lote en orden, con debounce rodante', async () => {
    const { batcher, calls } = setup();
    batcher.submit('a', item('1'));
    await jest.advanceTimersByTimeAsync(900);
    batcher.submit('a', item('2'));
    await jest.advanceTimersByTimeAsync(900);
    batcher.submit('a', item('3'));
    await jest.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([{ id: 'a', texts: ['1', '2', '3'] }]);
  });

  it('mensaje durante la corrida: segundo lote después, sin concurrencia', async () => {
    const { batcher, calls, release, maxActive } = setup();
    batcher.submit('a', item('1'));
    await jest.advanceTimersByTimeAsync(1000);
    batcher.submit('a', item('2'));
    await jest.advanceTimersByTimeAsync(5000); // vence el timer con la corrida activa
    expect(calls).toHaveLength(1);
    await release();
    expect(calls).toHaveLength(1); // aún espera el nuevo periodo de silencio
    await jest.advanceTimersByTimeAsync(1000);
    expect(calls[1]).toEqual({ id: 'a', texts: ['2'] });
    await release();
    expect(maxActive()).toBe(1);
  });

  it('contactos independientes corren en paralelo', async () => {
    const { batcher, calls, maxActive } = setup();
    batcher.submit('a', item('1'));
    batcher.submit('b', item('2'));
    await jest.advanceTimersByTimeAsync(1000);
    expect(calls.map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(maxActive()).toBe(2);
  });

  it('si el handler falla libera al contacto y conserva lo llegado durante la falla', async () => {
    const { batcher, calls, release, fail } = setup();
    fail();
    batcher.submit('a', item('1'));
    await jest.advanceTimersByTimeAsync(1000);
    batcher.submit('a', item('2'));
    await release();
    await jest.advanceTimersByTimeAsync(1000);
    expect(calls[1]).toEqual({ id: 'a', texts: ['2'] });
  });

  it('immediate sin corrida activa: se procesa ya, con lo pendiente', async () => {
    const { batcher, calls } = setup();
    batcher.submit('a', item('texto'));
    batcher.submit('a', item('boton'), { immediate: true });
    await jest.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([{ id: 'a', texts: ['texto', 'boton'] }]);
  });

  it('immediate con corrida activa: se procesa al terminar, sin esperar el silencio', async () => {
    const { batcher, calls, release } = setup();
    batcher.submit('a', item('1'));
    await jest.advanceTimersByTimeAsync(1000);
    batcher.submit('a', item('boton'), { immediate: true });
    await jest.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(1);
    await release();
    expect(calls[1]).toEqual({ id: 'a', texts: ['boton'] });
  });

  it('botón + texto durante una corrida: un solo lote al terminar, sin lotes vacíos ni corridas solapadas', async () => {
    const { batcher, calls, release, maxActive } = setup();
    batcher.submit('a', item('1'));
    await jest.advanceTimersByTimeAsync(1000); // corrida N activa
    batcher.submit('a', item('boton'), { immediate: true });
    batcher.submit('a', item('texto')); // arma un timer mientras corre
    await release(); // N termina: sale la corrida urgente [boton, texto]
    expect(calls[1]).toEqual({ id: 'a', texts: ['boton', 'texto'] });
    await jest.advanceTimersByTimeAsync(5000); // el timer huérfano ya no dispara nada
    await release();
    expect(calls).toHaveLength(2);
    expect(calls.every((c) => c.texts.length > 0)).toBe(true);
    expect(maxActive()).toBe(1);
  });

  it('BATCH_QUIET_MS inválido usa el valor por defecto', () => {
    for (const bad of ['abc', '0', '-5']) {
      const b = new InMemoryMessageBatcher({ get: () => bad } as any);
      expect((b as any).quietMs).toBe(DEFAULT_BATCH_QUIET_MS);
    }
  });
});
