import { OutboundDispatcher } from './outbound.dispatcher';

function setup() {
  const whatsapp: any = {
    sendMessage: jest.fn(async () => ({ messages: [{ id: 'wamid.out' }] })),
    sendTyping: jest.fn(async () => true),
  };
  const messages: any = { create: (r: any) => r, save: jest.fn() };
  return {
    dispatcher: new OutboundDispatcher(whatsapp, messages),
    whatsapp,
    messages,
  };
}

describe('OutboundDispatcher', () => {
  it('envía un mensaje válido sin cambios y lo registra con su texto', async () => {
    const { dispatcher, whatsapp, messages } = setup();
    await dispatcher.send('52', {
      kind: 'buttons',
      text: 'Hola',
      buttons: [{ id: 'billing', title: 'Facturación' }],
    });
    expect(whatsapp.sendMessage).toHaveBeenCalledWith({
      to: '52',
      textBody: 'Hola',
      buttons: [{ id: 'billing', title: 'Facturación' }],
    });
    expect(messages.save).toHaveBeenCalledWith({
      phone: '+52',
      direction: 'out',
      content: 'Hola\n[Facturación]',
      wamid: 'wamid.out',
    });
  });

  it('mensaje inválido: no lo envía y manda el texto de respaldo', async () => {
    const { dispatcher, whatsapp, messages } = setup();
    jest.spyOn((dispatcher as any).logger, 'error').mockImplementation();
    await dispatcher.send('52', {
      kind: 'buttons',
      text: 'x',
      buttons: Array.from({ length: 4 }, (_, i) => ({
        id: `${i}`,
        title: 'b',
      })),
    });
    expect(whatsapp.sendMessage).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendMessage.mock.calls[0][0]).toEqual({
      to: '52',
      textBody: expect.stringMatching(/Lo siento/),
    });
    expect(messages.save.mock.calls[0][0].content).toMatch(/Lo siento/);
  });

  it('documento: traduce nombre y caption', async () => {
    const { dispatcher, whatsapp } = setup();
    await dispatcher.send('52', {
      kind: 'document',
      url: 'https://x/f.pdf',
      filename: 'f.pdf',
      caption: 'tu factura',
    });
    expect(whatsapp.sendMessage.mock.calls[0][0]).toEqual({
      to: '52',
      documentUrl: 'https://x/f.pdf',
      documentFilename: 'f.pdf',
      caption: 'tu factura',
    });
  });

  it('documento por mediaId: lo pasa a WhatsApp por id; el texto del registro solo lleva el nombre y media la referencia', async () => {
    const { dispatcher, whatsapp, messages } = setup();
    await dispatcher.send('52', {
      kind: 'document',
      mediaId: 'media-1',
      filename: 'Prefactura.pdf',
    });
    expect(whatsapp.sendMessage.mock.calls[0][0]).toMatchObject({
      to: '52',
      documentMediaId: 'media-1',
      documentFilename: 'Prefactura.pdf',
    });
    expect(messages.save.mock.calls[0][0].content).toBe(
      '[documento: Prefactura.pdf]',
    );
    expect(messages.save.mock.calls[0][0].media).toEqual({
      kind: 'document',
      mediaId: 'media-1',
      url: undefined,
      filename: 'Prefactura.pdf',
    });
  });

  it('botones con encabezado por mediaId: el texto no contiene bytes ni id; media guarda la referencia', async () => {
    const { dispatcher, whatsapp, messages } = setup();
    await dispatcher.send('52', {
      kind: 'buttons',
      text: '¿Los datos son correctos?',
      buttons: [
        { id: 'confirm_emission', title: 'Sí' },
        { id: 'reject_emission', title: 'No' },
      ],
      document: { mediaId: 'media-1', filename: 'Prefactura.pdf' },
    });
    expect(whatsapp.sendMessage.mock.calls[0][0].headerDocument).toEqual({
      mediaId: 'media-1',
      filename: 'Prefactura.pdf',
    });
    const content = messages.save.mock.calls[0][0].content as string;
    expect(content).toContain('[documento: Prefactura.pdf]');
    expect(content).not.toContain('media-1');
    expect(messages.save.mock.calls[0][0].media).toMatchObject({
      kind: 'document',
      mediaId: 'media-1',
      filename: 'Prefactura.pdf',
    });
  });

  it('imagen: media guarda la URL', async () => {
    const { dispatcher, messages } = setup();
    await dispatcher.send('52', { kind: 'image', url: 'https://x/a.jpg' });
    expect(messages.save.mock.calls[0][0].media).toEqual({
      kind: 'image',
      url: 'https://x/a.jpg',
    });
  });

  it('si Meta rechaza el envío loguea el error y no lo registra como enviado', async () => {
    const { dispatcher, whatsapp, messages } = setup();
    whatsapp.sendMessage.mockResolvedValue({
      error: { code: 131030, message: 'Recipient not in allowed list' },
    });
    const log = jest
      .spyOn((dispatcher as any).logger, 'error')
      .mockImplementation();
    const sent = await dispatcher.send('52', {
      kind: 'text',
      text: 'hola',
    });
    expect(sent).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('131030'));
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('fallo de red (sendMessage devuelve undefined): no se registra', async () => {
    const { dispatcher, whatsapp, messages } = setup();
    whatsapp.sendMessage.mockResolvedValue(undefined);
    jest.spyOn((dispatcher as any).logger, 'error').mockImplementation();
    expect(await dispatcher.send('52', { kind: 'text', text: 'hola' })).toBe(
      false,
    );
    expect(messages.save).not.toHaveBeenCalled();
  });

  it('typing: delega en sendTyping y no registra nada en el log', async () => {
    const { dispatcher, whatsapp, messages } = setup();
    expect(await dispatcher.typing('wamid.in')).toBe(true);
    expect(whatsapp.sendTyping).toHaveBeenCalledWith('wamid.in');
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
    expect(messages.save).not.toHaveBeenCalled();
  });
});
