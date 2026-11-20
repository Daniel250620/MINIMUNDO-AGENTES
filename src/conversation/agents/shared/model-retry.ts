import type { HttpOptions } from '@google/genai';

/** Tiempo máximo por intento de llamada al modelo (ms). Valor inicial: ajustar con las métricas de model-metrics. */
export const MODEL_TIMEOUT_MS = 30_000;

/**
 * Reintentos de la llamada al modelo (3 intentos contando el primero, espera 1 s y luego 2 s) ante 503/429.
 * Van en el cliente de genai porque Runner.runAsync sin newMessage no ejecuta el agente: no se puede reintentar desde fuera.
 * Función y no constante: ADK escribe `headers` sobre este objeto en cada llamada, no debe compartirse entre agentes.
 */
export const modelRetryHttpOptions = (): HttpOptions => ({
  timeout: MODEL_TIMEOUT_MS,
  retryOptions: { attempts: 3, initialDelay: 1, httpStatusCodes: [429, 503] },
});
