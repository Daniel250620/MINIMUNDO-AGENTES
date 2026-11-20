import { renderStateBlock } from './render-state-block';

describe('renderStateBlock', () => {
  it('state vacío: bloque vacío, sin placeholders', () => {
    expect(renderStateBlock({})).toBe('');
    expect(renderStateBlock({ turn: 'x', customerName: null })).toBe('');
  });

  it('muestra sólo las claves conocidas', () => {
    const block = renderStateBlock({
      customerName: 'Ana',
      phone: '+5215512345678',
      turn: 't',
      outbound: {},
    });
    expect(block).toContain('- Nombre: Ana');
    expect(block).toContain('- Teléfono: +5215512345678');
    expect(block).not.toContain('turn');
  });
});
