import { Logger } from '@nestjs/common';
import { logModelCall, startModelTimer } from './model-metrics';

const ctx: any = { invocationId: 'i1', agentName: 'billing_agent' };

describe('métricas de llamadas al modelo', () => {
  it('registra agente, duración y tokens de razonamiento, sin contenido', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    startModelTimer({ context: ctx, request: {} as any });
    logModelCall({
      context: ctx,
      response: {
        content: { parts: [{ text: 'RFC XAXX010101000' }] },
        usageMetadata: { thoughtsTokenCount: 42 },
      },
    });
    const line = log.mock.calls[0][0] as string;
    expect(line).toMatch(/agent=billing_agent ms=\d+ thoughtTokens=42/);
    expect(line).not.toContain('XAXX');
    log.mockRestore();
  });

  it('sin inicio previo no registra nada', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    logModelCall({
      context: { ...ctx, invocationId: 'otro' },
      response: {},
    });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
