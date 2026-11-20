import type { OutboundMessage } from './outbound-message';
import { validateOutbound } from './validate-outbound';

const btn = (title = 'Facturación') => ({ id: title, title });
const row = (over = {}) => ({ id: 'r', title: 'Fila', ...over });
const list = (over = {}): OutboundMessage => ({
  kind: 'list',
  text: 'Elige',
  buttonLabel: 'Ver menú',
  rows: [row()],
  ...over,
});
const x = (n: number) => 'x'.repeat(n);

describe('validateOutbound', () => {
  it.each<[string, OutboundMessage, RegExp]>([
    ['texto > 4096', { kind: 'text', text: x(4097) }, /4096/],
    [
      'cuerpo de botones > 1024',
      { kind: 'buttons', text: x(1025), buttons: [btn()] },
      /1024/,
    ],
    [
      '4 botones',
      {
        kind: 'buttons',
        text: 'a',
        buttons: [btn('1'), btn('2'), btn('3'), btn('4')],
      },
      /3 botones/,
    ],
    [
      'título de botón > 20',
      { kind: 'buttons', text: 'a', buttons: [btn(x(21))] },
      /20 caracteres/,
    ],
    ['cuerpo de lista > 1024', list({ text: x(1025) }), /1024/],
    [
      '11 filas',
      list({ rows: Array.from({ length: 11 }, () => row()) }),
      /10 filas/,
    ],
    ['título de fila > 24', list({ rows: [row({ title: x(25) })] }), /24/],
    ['descripción > 72', list({ rows: [row({ description: x(73) })] }), /72/],
    ['etiqueta > 20', list({ buttonLabel: x(21) }), /etiqueta/],
    [
      'documento sin url ni mediaId',
      { kind: 'document', filename: 'f.pdf' },
      /exactamente uno/,
    ],
    [
      'documento con url y mediaId',
      { kind: 'document', url: 'https://x/f.pdf', mediaId: 'm', filename: 'f' },
      /exactamente uno/,
    ],
    [
      'encabezado de botones sin url ni mediaId',
      {
        kind: 'buttons',
        text: 'a',
        buttons: [btn()],
        document: { filename: 'f.pdf' },
      },
      /exactamente uno/,
    ],
  ])('rechaza %s', (_n, msg, re) => {
    expect(() => validateOutbound(msg)).toThrow(re);
  });

  it('acepta mensajes dentro de los límites (incluidos los exactos)', () => {
    expect(() =>
      validateOutbound({ kind: 'text', text: x(4096) }),
    ).not.toThrow();
    expect(() =>
      validateOutbound({
        kind: 'buttons',
        text: x(1024),
        buttons: [btn(x(20)), btn('b'), btn('c')],
      }),
    ).not.toThrow();
    expect(() =>
      validateOutbound(
        list({
          buttonLabel: x(20),
          rows: Array.from({ length: 10 }, () =>
            row({ title: x(24), description: x(72) }),
          ),
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateOutbound({ kind: 'image', url: 'https://x/y.png' }),
    ).not.toThrow();
  });

  it('acepta documentos por url o por mediaId, sueltos o en botones', () => {
    for (const src of [{ url: 'https://x/f.pdf' }, { mediaId: 'm1' }]) {
      expect(() =>
        validateOutbound({ kind: 'document', filename: 'f.pdf', ...src }),
      ).not.toThrow();
      expect(() =>
        validateOutbound({
          kind: 'buttons',
          text: 'a',
          buttons: [btn()],
          document: { filename: 'f.pdf', ...src },
        }),
      ).not.toThrow();
    }
  });
});
