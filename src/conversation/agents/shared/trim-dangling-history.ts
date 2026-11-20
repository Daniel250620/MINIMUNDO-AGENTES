import type { LlmRequest } from '@google/adk';

/**
 * getSession sólo carga los últimos N eventos y Gemini responde 400 si el
 * historial no abre con un turno `user` limpio: se descarta lo que sobre al inicio.
 */
export function trimDanglingHistory({ request }: { request: LlmRequest }) {
  const isCleanUser = (c: LlmRequest['contents'][number]) =>
    c.role === 'user' && !c.parts?.some((p) => p.functionResponse);
  const first = request.contents.findIndex(isCleanUser);
  if (first > 0) request.contents.splice(0, first);
  return undefined;
}
