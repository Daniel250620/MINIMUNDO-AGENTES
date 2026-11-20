import { stripReplyContext, withReplyContext } from './reply-context';

describe('reply-context', () => {
  it('ida y vuelta: quitar el prefijo devuelve el texto original', () => {
    const text = withReplyContext('Tu factura', 'Muy buen servicio');
    expect(text).toBe('[En respuesta a: "Tu factura"]\nMuy buen servicio');
    expect(stripReplyContext(text)).toBe('Muy buen servicio');
  });

  it('sin cita deja el texto igual', () => {
    expect(withReplyContext(undefined, 'hola')).toBe('hola');
    expect(stripReplyContext('hola')).toBe('hola');
  });

  it('cita sin texto queda vacía tras limpiar', () => {
    const text = withReplyContext('Tu factura', undefined);
    expect(text).toBe('[En respuesta a: "Tu factura"]');
    expect(stripReplyContext(text!)).toBe('');
  });
});
