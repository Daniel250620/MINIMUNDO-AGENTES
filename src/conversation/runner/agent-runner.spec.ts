import { createEvent, LlmAgent } from '@google/adk';
import { AgentRunner } from './agent-runner';

const finalEvent = (text: string) =>
  createEvent({
    author: 'assistant_agent',
    content: { role: 'model', parts: [{ text }] },
  });

const toolEvent = (name: string, response: Record<string, unknown>) =>
  createEvent({
    author: 'assistant_agent',
    content: {
      role: 'user',
      parts: [{ functionResponse: { name, response } }],
    },
    actions: { skipSummarization: true },
  });

const gen = (...items: any[]) =>
  (async function* () {
    for (const i of items) {
      if (i instanceof Error) throw i;
      yield i;
    }
  })();

const buttons = {
  kind: 'buttons',
  text: 'Hola',
  buttons: [{ id: 'billing', title: 'Facturación' }],
};
const content = { role: 'user', parts: [{ text: 'hola' }] };
const params = { userId: '521', sessionId: '521', content, turn: 't2' };

function setup(state: Record<string, unknown> = {}) {
  const sessionService: any = {
    getSession: jest.fn(async () => ({ state })),
  };
  const runner = new AgentRunner(
    { agent: new LlmAgent({ name: 'assistant_agent' }) },
    sessionService,
    {} as any,
  );
  jest.spyOn((runner as any).logger, 'error').mockImplementation();
  const runAsync = jest.fn();
  (runner as any).runner = { runAsync };
  return { runner, runAsync };
}

describe('AgentRunner', () => {
  it('devuelve el texto final del modelo', async () => {
    const { runner, runAsync } = setup();
    runAsync.mockReturnValueOnce(gen(finalEvent('¡Hola!')));
    expect(await runner.run(params)).toEqual({ answer: '¡Hola!' });
  });

  it('siembra turn en el state', async () => {
    const { runner, runAsync } = setup();
    runAsync.mockReturnValueOnce(gen(finalEvent('ok')));
    await runner.run(params);
    expect(runAsync.mock.calls[0][0]).toMatchObject({
      newMessage: content,
      stateDelta: { turn: 't2' },
    });
  });

  it('un errorCode del modelo o una excepción marcan failed, con un solo runAsync', async () => {
    const { runner, runAsync } = setup();
    runAsync
      .mockReturnValueOnce(
        gen(createEvent({ errorCode: '503', errorMessage: 'UNAVAILABLE' })),
      )
      .mockReturnValueOnce(gen(new Error('400 bad request')));
    expect(await runner.run(params)).toEqual({ answer: '', failed: true });
    expect(await runner.run(params)).toEqual({ answer: '', failed: true });
    expect(runAsync).toHaveBeenCalledTimes(2);
  });

  it('un STOP vacío (errorCode STOP sin parts) no es error: conserva el outbound del state', async () => {
    const { runner, runAsync } = setup({
      outbound: { turnId: 't2', message: buttons },
    });
    runAsync.mockReturnValueOnce(
      gen(createEvent({ errorCode: 'STOP', finishReason: 'STOP' as any })),
    );
    expect(await runner.run(params)).toEqual({ answer: '', outbound: buttons });
  });

  describe('mensaje de salida', () => {
    it('toma el OutboundMessage del resultado de una tool por su kind, sea cual sea el nombre', async () => {
      const { runner, runAsync } = setup();
      runAsync.mockReturnValueOnce(gen(toolEvent('cualquier_tool', buttons)));
      expect((await runner.run(params)).outbound).toEqual(buttons);
    });

    it('lo toma también si viene envuelto en result', async () => {
      const { runner, runAsync } = setup();
      runAsync.mockReturnValueOnce(gen(toolEvent('t', { result: buttons })));
      expect((await runner.run(params)).outbound).toEqual(buttons);
    });

    it('lee el outbound que dejó un sub-agente en el state con el turnId de la corrida', async () => {
      const { runner, runAsync } = setup({
        outbound: { turnId: 't2', message: buttons },
      });
      runAsync.mockReturnValueOnce(
        gen(toolEvent('billing_agent', { result: 'texto del sub-agente' })),
      );
      const res = await runner.run(params);
      expect(res.outbound).toEqual(buttons);
      expect(res.answer).toBe('texto del sub-agente');
    });

    it('ignora un outbound de una corrida anterior', async () => {
      const { runner, runAsync } = setup({
        outbound: { turnId: 't1', message: buttons },
      });
      runAsync.mockReturnValueOnce(gen(finalEvent('sólo texto')));
      expect(await runner.run(params)).toEqual({ answer: 'sólo texto' });
    });
  });
});
