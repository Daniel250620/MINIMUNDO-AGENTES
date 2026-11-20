import { FunctionCallingConfigMode } from '@google/genai';
import type { LlmRequest } from '@google/adk';

/**
 * Obliga al modelo a llamar `toolName` en su primera llamada del turno (el último contenido es del cliente); tras la
 * respuesta de la tool vuelve al modo normal para que pueda redactar. Sin esto el modelo a veces contesta con texto y
 * se salta la tool, y el sistema no manda sus preguntas con botones.
 */
export const forceToolCall =
  (toolName: string) =>
  ({ request }: { request: LlmRequest }) => {
    const last = request.contents.at(-1);
    if (last?.parts?.some((p) => p.functionResponse)) return undefined;
    request.config ??= {};
    request.config.toolConfig = {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: [toolName],
      },
    };
    return undefined;
  };
