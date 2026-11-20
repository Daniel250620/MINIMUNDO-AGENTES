import { parseWebhook } from './parse-webhook';

const wrap = (messages: any[], extra: any = {}) => ({
  entry: [
    {
      changes: [
        {
          value: {
            messages,
            contacts: [{ wa_id: '52', profile: { name: 'Ana' } }],
            ...extra,
          },
        },
      ],
    },
  ],
});
const base = { from: '52', id: 'w1' };

describe('parseWebhook', () => {
  it('texto', () => {
    const [m] = parseWebhook(
      wrap([{ ...base, type: 'text', text: { body: 'hola' } }]),
    );
    expect(m).toMatchObject({
      type: 'text',
      text: 'hola',
      wamid: 'w1',
      from: '52',
      contactName: 'Ana',
      replyToWamid: null,
    });
  });

  it('imagen con caption', () => {
    const [m] = parseWebhook(
      wrap([
        {
          ...base,
          type: 'image',
          image: { id: 'm1', mime_type: 'image/jpeg', caption: 'mi ticket' },
        },
      ]),
    );
    expect(m).toMatchObject({
      type: 'image',
      text: 'mi ticket',
      mediaId: 'm1',
    });
  });

  it('documento', () => {
    const [m] = parseWebhook(
      wrap([
        {
          ...base,
          type: 'document',
          document: { id: 'm2', filename: 'csf.pdf' },
        },
      ]),
    );
    expect(m).toMatchObject({
      type: 'document',
      text: null,
      mediaId: 'm2',
      filename: 'csf.pdf',
    });
  });

  it('ubicación con coordenadas y texto', () => {
    const [m] = parseWebhook(
      wrap([
        {
          ...base,
          type: 'location',
          location: { latitude: 17.06, longitude: -96.72, name: 'Zócalo' },
        },
      ]),
    );
    expect(m.location).toEqual({ latitude: 17.06, longitude: -96.72 });
    expect(m.text).toBe('Ubicación: 17.06, -96.72 (Zócalo)');
  });

  it('botón y lista conservan id y título', () => {
    const [b, l] = parseWebhook(
      wrap([
        {
          ...base,
          type: 'interactive',
          interactive: {
            type: 'button_reply',
            button_reply: { id: 'billing', title: 'Facturación' },
          },
        },
        {
          ...base,
          id: 'w2',
          type: 'interactive',
          interactive: {
            type: 'list_reply',
            list_reply: { id: 'r1', title: 'Fila 1' },
          },
        },
      ]),
    );
    expect(b).toMatchObject({
      type: 'interactive',
      text: 'Facturación',
      selection: { id: 'billing', title: 'Facturación' },
    });
    expect(l.selection).toEqual({ id: 'r1', title: 'Fila 1' });
  });

  it('botón de plantilla sale como selección con su payload y el mensaje citado', () => {
    const [m] = parseWebhook(
      wrap([
        {
          ...base,
          type: 'button',
          context: { id: 'tpl1' },
          button: { payload: 'case-rate:c1', text: 'Calificar atención' },
        },
      ]),
    );
    expect(m).toMatchObject({
      type: 'interactive',
      rawType: 'button',
      text: 'Calificar atención',
      selection: { id: 'case-rate:c1', title: 'Calificar atención' },
      replyToWamid: 'tpl1',
    });
  });

  it('audio y otros tipos salen como unsupported', () => {
    const [m] = parseWebhook(wrap([{ ...base, type: 'audio', audio: {} }]));
    expect(m.type).toBe('unsupported');
  });

  it('unsupported de Meta conserva errors para diagnóstico', () => {
    const errors = [{ code: 131051, title: 'Message type unknown' }];
    const [m] = parseWebhook(wrap([{ ...base, type: 'unsupported', errors }]));
    expect(m).toMatchObject({
      type: 'unsupported',
      rawType: 'unsupported',
      errors,
    });
  });

  it('procesa todos los mensajes del payload en orden', () => {
    const out = parseWebhook(
      wrap([
        { ...base, id: 'a', type: 'text', text: { body: '1' } },
        { ...base, id: 'b', type: 'text', text: { body: '2' } },
      ]),
    );
    expect(out.map((m) => m.wamid)).toEqual(['a', 'b']);
  });

  it('guarda el wamid citado', () => {
    const [m] = parseWebhook(
      wrap([
        {
          ...base,
          type: 'text',
          text: { body: 'sí' },
          context: { id: 'w0' },
        },
      ]),
    );
    expect(m.replyToWamid).toBe('w0');
  });

  it('payload sólo de statuses no produce mensajes', () => {
    expect(
      parseWebhook({
        entry: [{ changes: [{ value: { statuses: [{ status: 'read' }] } }] }],
      }),
    ).toEqual([]);
    expect(parseWebhook({})).toEqual([]);
  });
});
