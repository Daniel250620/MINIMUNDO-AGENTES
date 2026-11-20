import { Logger } from '@nestjs/common';
import type { Context, LlmRequest } from '@google/adk';
import type { LlmResponse } from '@google/adk';

const logger = new Logger('ModelCall');

// Las llamadas de un mismo agente dentro de una invocación son secuenciales: una entrada por clave basta.
// ponytail: una llamada abortada por timeout deja su entrada sin borrar; es un número por falla, limpiar si el volumen de fallas crece.
const startedAt = new Map<string, number>();
const key = (ctx: Context) => `${ctx.invocationId}:${ctx.agentName}`;

/** Marca el inicio de la llamada al modelo. No modifica la petición. */
export function startModelTimer({
  context,
}: {
  context: Context;
  request: LlmRequest;
}) {
  startedAt.set(key(context), Date.now());
  return undefined;
}

/** Registra agente, duración y tokens de razonamiento; nunca el contenido ni datos personales. */
export function logModelCall({
  context,
  response,
}: {
  context: Context;
  response: LlmResponse;
}) {
  const t0 = startedAt.get(key(context));
  startedAt.delete(key(context));
  if (t0 === undefined) return undefined;
  logger.log(
    `model agent=${context.agentName} ms=${Date.now() - t0} thoughtTokens=${response.usageMetadata?.thoughtsTokenCount ?? 0}`,
  );
  return undefined;
}
