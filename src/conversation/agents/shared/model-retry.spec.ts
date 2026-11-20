import { Gemini } from '@google/adk';
import { modelRetryHttpOptions } from './model-retry';

const ok = () =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
const status = (code: number) =>
  new Response(JSON.stringify({ error: { code, message: 'x' } }), {
    status: code,
  });

/** Misma ruta que en producción: LlmRequest.config.httpOptions → Gemini (ADK) → genai → apiCall con retryOptions. */
async function call(fetchMock: jest.Mock) {
  const base = modelRetryHttpOptions();
  const llm = new Gemini({ model: 'gemini-test', apiKey: 'k' });
  const req: any = {
    contents: [{ role: 'user', parts: [{ text: 'hola' }] }],
    config: {
      httpOptions: {
        ...base,
        // delay corto para el test; el resto de la política es la real
        retryOptions: { ...base.retryOptions, initialDelay: 0.01 },
        fetch: fetchMock,
      },
    },
    toolsDict: {},
    liveConnectConfig: {},
  };
  const out: any[] = [];
  for await (const r of llm.generateContentAsync(req)) out.push(r);
  return out;
}

describe('política de reintentos del modelo (genai)', () => {
  it('declara 3 intentos con espera inicial de 1 s ante 429/503', () => {
    expect(modelRetryHttpOptions().retryOptions).toEqual({
      attempts: 3,
      initialDelay: 1,
      httpStatusCodes: [429, 503],
    });
  });

  it('fija un tiempo máximo por intento de 30 s', () => {
    expect(modelRetryHttpOptions().timeout).toBe(30_000);
  });

  it('503 y luego 200: reintenta y responde', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(ok());
    const out = await call(fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out[0].content.parts[0].text).toBe('ok');
  });

  it('503 persistente: se rinde tras 3 intentos', async () => {
    const fetchMock = jest.fn().mockImplementation(() => status(503));
    await expect(call(fetchMock)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('un 400 no se reintenta', async () => {
    const fetchMock = jest.fn().mockImplementation(() => status(400));
    await expect(call(fetchMock)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
