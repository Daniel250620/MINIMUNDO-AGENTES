import { WhatsappService } from './whatsapp.service';

/** Cuerpo JSON que sendMessage manda a Meta. */
async function sentBody(data: Parameters<WhatsappService['sendMessage']>[0]) {
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValue({ json: () => Promise.resolve({}) } as Response);
  await new WhatsappService().sendMessage(data);
  const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  fetchMock.mockRestore();
  return body;
}

describe('WhatsappService.sendMessage', () => {
  it('texto', async () => {
    const b = await sentBody({ to: '52', textBody: 'hola' });
    expect(b).toMatchObject({ type: 'text', text: { body: 'hola' } });
  });

  it('botones con id y título', async () => {
    const b = await sentBody({
      to: '52',
      textBody: 'elige',
      buttons: [{ id: 'billing', title: 'Facturación' }],
    });
    expect(b.type).toBe('interactive');
    expect(b.interactive).toMatchObject({
      type: 'button',
      body: { text: 'elige' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'billing', title: 'Facturación' } },
        ],
      },
    });
  });

  it('lista interactiva', async () => {
    const rows = [{ id: 'a', title: 'A', description: 'uno' }];
    const b = await sentBody({
      to: '52',
      textBody: 'menú',
      list: { buttonLabel: 'Ver', rows },
    });
    expect(b.type).toBe('interactive');
    expect(b.interactive).toEqual({
      type: 'list',
      body: { text: 'menú' },
      action: { button: 'Ver', sections: [{ rows }] },
    });
    expect(b.text).toBeUndefined();
  });

  it('documento con nombre y caption', async () => {
    const b = await sentBody({
      to: '52',
      documentUrl: 'https://x/f.pdf',
      documentFilename: 'f.pdf',
      caption: 'tu factura',
    });
    expect(b).toMatchObject({
      type: 'document',
      document: {
        link: 'https://x/f.pdf',
        filename: 'f.pdf',
        caption: 'tu factura',
      },
    });
  });

  it('documento por mediaId: manda id y no link', async () => {
    const b = await sentBody({
      to: '52',
      documentMediaId: 'media-1',
      documentFilename: 'Prefactura.pdf',
    });
    expect(b.type).toBe('document');
    expect(b.document).toMatchObject({
      id: 'media-1',
      filename: 'Prefactura.pdf',
    });
    expect(b.document.link).toBeUndefined();
  });

  it('botones con documento por mediaId en el encabezado', async () => {
    const b = await sentBody({
      to: '52',
      textBody: '¿correcto?',
      buttons: [{ id: 'confirm_emission', title: 'Sí' }],
      headerDocument: { mediaId: 'media-1', filename: 'Prefactura.pdf' },
    });
    expect(b.type).toBe('interactive');
    expect(b.interactive.header).toEqual({
      type: 'document',
      document: { id: 'media-1', filename: 'Prefactura.pdf' },
    });
  });

  it('botones con documento por url conservan el link', async () => {
    const b = await sentBody({
      to: '52',
      textBody: '¿correcto?',
      buttons: [{ id: 'confirm_emission', title: 'Sí' }],
      headerDocument: { url: 'https://x/f.pdf', filename: 'f.pdf' },
    });
    expect(b.interactive.header.document).toEqual({
      link: 'https://x/f.pdf',
      filename: 'f.pdf',
    });
  });

  it('imagen', async () => {
    const b = await sentBody({ to: '52', imageUrl: 'https://x/i.png' });
    expect(b).toMatchObject({
      type: 'image',
      image: { link: 'https://x/i.png' },
    });
  });
});

describe('WhatsappService.getMedia', () => {
  const meta = (over = {}, ok = true) =>
    ({
      ok,
      status: ok ? 200 : 401,
      json: () =>
        Promise.resolve({
          url: 'https://cdn/f',
          mime_type: 'image/jpeg',
          file_size: 100,
          ...over,
        }),
    }) as unknown as Response;
  const file = (bytes = 100, ok = true, headers: Record<string, string> = {}) =>
    ({
      ok,
      status: ok ? 200 : 404,
      headers: new Headers(headers),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(bytes)),
    }) as unknown as Response;
  const run = async (
    responses: Response[],
    max?: Parameters<WhatsappService['getMedia']>[1],
  ) => {
    const fetchMock = jest.spyOn(global, 'fetch');
    responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
    const svc = new WhatsappService();
    jest.spyOn((svc as any).logger, 'warn').mockImplementation();
    const res = await svc.getMedia('m1', max);
    const calls = fetchMock.mock.calls.length;
    const inits = fetchMock.mock.calls.map((c) => c[1]);
    fetchMock.mockRestore();
    return { res, calls, inits };
  };

  it('descarga y normaliza el mime (sin parámetros, en minúsculas)', async () => {
    const { res, inits } = await run([
      meta({ mime_type: 'Application/PDF; charset=binary' }),
      file(10),
    ]);
    expect(res!.mimeType).toBe('application/pdf');
    expect(res!.buffer.length).toBe(10);
    expect(inits.every((i) => i!.signal)).toBe(true); // timeout en ambos fetch
  });

  it('metadata no ok: null sin segundo fetch', async () => {
    const { res, calls } = await run([meta({}, false)]);
    expect(res).toBeNull();
    expect(calls).toBe(1);
  });

  it('descarga no ok (401/404): null', async () => {
    expect((await run([meta(), file(10, false)])).res).toBeNull();
  });

  it('file_size sobre el tope: rechaza antes del segundo fetch', async () => {
    const { res, calls } = await run(
      [meta({ file_size: 6_000_000 })],
      5_000_000,
    );
    expect(res).toBeNull();
    expect(calls).toBe(1);
  });

  it('el tope puede depender del mime; <= 0 rechaza el tipo sin bajarlo', async () => {
    const { res, calls } = await run(
      [meta({ mime_type: 'application/zip' })],
      (mime) => (mime === 'image/jpeg' ? 100 : 0),
    );
    expect(res).toBeNull();
    expect(calls).toBe(1);
  });

  it('Content-Length sobre el tope: null', async () => {
    const { res } = await run(
      [
        meta({ file_size: undefined }),
        file(10, true, { 'content-length': '999' }),
      ],
      100,
    );
    expect(res).toBeNull();
  });

  it('cuerpo real sobre el tope aunque la metadata mienta: null', async () => {
    expect((await run([meta(), file(500)], 100)).res).toBeNull();
  });

  it('sin tope se mantiene el comportamiento anterior', async () => {
    expect((await run([meta(), file(5000)])).res!.buffer.length).toBe(5000);
  });
});

describe('WhatsappService.sendTyping', () => {
  afterEach(() => jest.restoreAllMocks());

  it('manda read + typing_indicator con el wamid', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    expect(await new WhatsappService().sendTyping('wamid.in')).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toMatch(
      /graph\.facebook\.com\/v\d+\.\d+\/.*\/messages$/,
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.in',
      typing_indicator: { type: 'text' },
    });
  });

  it('respuesta de error: false y warn, sin lanzar', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('bad'),
    } as Response);
    const service = new WhatsappService();
    const warn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation();
    expect(await service.sendTyping('w')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('400'));
  });

  it('fallo de red: false y warn, sin lanzar', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('red'));
    const service = new WhatsappService();
    const warn = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation();
    expect(await service.sendTyping('w')).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('red'));
  });
});

describe('WhatsappService.uploadMedia', () => {
  const PDF = Buffer.from('%PDF-1.7 contenido');
  const reply = (ok: boolean, status: number, body?: unknown) =>
    ({
      ok,
      status,
      json: () =>
        body === undefined
          ? Promise.reject(new Error('x'))
          : Promise.resolve(body),
    }) as unknown as Response;

  afterEach(() => jest.restoreAllMocks());

  it('sube el archivo como multipart con el token y devuelve el id', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(reply(true, 200, { id: 'media-9' }));
    const id = await new WhatsappService().uploadMedia(
      PDF,
      'Prefactura.pdf',
      'application/pdf',
    );
    expect(id).toBe('media-9');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url as string).toMatch(/graph\.facebook\.com\/v18\.0\/.*\/media$/);
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>).Authorization).toMatch(
      /^Bearer /,
    );
    expect(init!.signal).toBeDefined();
    const form = init!.body as FormData;
    expect(form.get('messaging_product')).toBe('whatsapp');
    expect(form.get('type')).toBe('application/pdf');
    const file = form.get('file') as File;
    expect(file.name).toBe('Prefactura.pdf');
    expect(file.type).toBe('application/pdf');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(PDF);
  });

  it('Meta rechaza la subida: lanza sin incluir el cuerpo', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        reply(false, 400, { error: { message: 'secreto %PDF' } }),
      );
    await expect(
      new WhatsappService().uploadMedia(PDF, 'f.pdf', 'application/pdf'),
    ).rejects.toThrow(/HTTP 400/);
  });

  it('respuesta sin id o ilegible: lanza', async () => {
    const f = jest.spyOn(global, 'fetch');
    f.mockResolvedValueOnce(reply(true, 200, {}));
    await expect(
      new WhatsappService().uploadMedia(PDF, 'f.pdf', 'application/pdf'),
    ).rejects.toThrow();
    f.mockResolvedValueOnce(reply(true, 200));
    await expect(
      new WhatsappService().uploadMedia(PDF, 'f.pdf', 'application/pdf'),
    ).rejects.toThrow();
  });

  it('error de red: se propaga', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      new WhatsappService().uploadMedia(PDF, 'f.pdf', 'application/pdf'),
    ).rejects.toThrow('fetch failed');
  });
});
