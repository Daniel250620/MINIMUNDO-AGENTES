import { withUserLock } from './user-lock';

const tick = () => new Promise((r) => setImmediate(r));

describe('withUserLock', () => {
  it('serializa las tareas del mismo usuario en orden de llegada', async () => {
    const log: string[] = [];
    let release!: () => void;
    const first = withUserLock('u', async () => {
      log.push('a:start');
      await new Promise<void>((r) => (release = r));
      log.push('a:end');
    });
    const second = withUserLock('u', async () => void log.push('b'));
    await tick();
    expect(log).toEqual(['a:start']);
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(['a:start', 'a:end', 'b']);
  });

  it('usuarios distintos no se bloquean entre sí', async () => {
    let release!: () => void;
    const slow = withUserLock(
      'u1',
      () => new Promise<void>((r) => (release = r)),
    );
    const fast = await withUserLock('u2', () => Promise.resolve('listo'));
    expect(fast).toBe('listo');
    release();
    await slow;
  });

  it('una tarea que falla no bloquea a la siguiente y propaga su error', async () => {
    const failing = withUserLock('u', () => Promise.reject(new Error('x')));
    await expect(failing).rejects.toThrow('x');
    await expect(withUserLock('u', () => Promise.resolve(2))).resolves.toBe(2);
  });
});
