import type { LlmRequest } from '@google/adk';
import { forceToolCall } from './force-tool-call';

const run = (contents: LlmRequest['contents']) => {
  const request = { contents, config: {} } as LlmRequest;
  forceToolCall('register_cases')({ request });
  return request.config?.toolConfig;
};

describe('forceToolCall', () => {
  it('primera llamada del turno (último contenido del cliente): obliga a la tool', () => {
    expect(
      run([{ role: 'user', parts: [{ text: 'la comida llegó fría' }] }]),
    ).toEqual({
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: ['register_cases'],
      },
    });
  });

  it('tras la respuesta de la tool no fuerza nada, para que el modelo redacte', () => {
    expect(
      run([
        { role: 'user', parts: [{ text: 'hola' }] },
        {
          role: 'user',
          parts: [
            { functionResponse: { name: 'register_cases', response: {} } },
          ],
        },
      ]),
    ).toBeUndefined();
  });
});
