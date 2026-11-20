import { stateSummary } from './session-state';

describe('stateSummary', () => {
  it('incluye rechazo y bandera de atención sin RFC ni nombre', () => {
    const out = stateSummary({
      stampError: {
        kind: 'receptor',
        field: 'cp',
        code: 'CFDI40147',
        invoiceId: 'inv-1',
      },
      proformaRejected: true,
      attentionRequested: { reason: 'stamp_rejected', kind: 'receptor' },
      receptor: { rfc: 'XAXX010101000', nombre: 'PUBLICO EN GENERAL' },
    });
    expect(JSON.parse(out)).toMatchObject({
      stampError: { kind: 'receptor', field: 'cp' },
      proformaRejected: true,
      attentionRequested: true,
    });
    expect(out).not.toMatch(/XAXX|PUBLICO|CFDI40147|inv-1/);
  });
});
