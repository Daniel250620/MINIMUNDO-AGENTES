// ponytail: cola en memoria por usuario, de una sola instancia (como el batcher); con varias instancias usar un lock en Postgres.
const tails = new Map<string, Promise<unknown>>();

/** Serializa las escrituras al state de un usuario: el turno del agente y la tarea de esperas no se pisan. */
export function withUserLock<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const run = (tails.get(userId) ?? Promise.resolve()).then(fn, fn);
  const tail = run.catch(() => undefined);
  tails.set(userId, tail);
  void tail.then(() => {
    if (tails.get(userId) === tail) tails.delete(userId);
  });
  return run;
}
