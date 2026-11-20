import convertHeic from 'heic-convert';
import type { IncomingMessage } from './incoming-message';
import { attachmentName, InboundService } from './inbound.service';

jest.mock('heic-convert', () => jest.fn());
const convertMock = convertHeic as unknown as jest.Mock;

const msg = (over: Partial<IncomingMessage> = {}): IncomingMessage => ({
  from: '52',
  wamid: 'wamid.X=',
  contactName: null,
  type: 'image',
  rawType: 'image',
  text: null,
  replyToWamid: null,
  mediaId: 'm1',
  ...over,
});

function setup(media: any, quoted?: any) {
  const getMedia = jest.fn(async () => media);
  const whatsapp: any = { getMedia };
  const messages: any = { findOne: jest.fn(async () => quoted) };
  const svc = new InboundService(whatsapp, messages);
  jest.spyOn((svc as any).logger, 'warn').mockImplementation();
  return { svc, messages, getMedia };
}
/** Bytes iniciales reales por tipo, para que pase la revisión de contenido. */
const MAGIC: Record<string, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};
const file = (mimeType: string, bytes: number, head = MAGIC[mimeType]) => {
  const buffer = Buffer.alloc(bytes);
  if (head) Buffer.from(head).copy(buffer);
  return { mimeType, buffer };
};
const HEIC_HEAD = [...Buffer.from('\0\0\0\x18ftypheic', 'latin1')];
const DOCX_HEAD = [0x50, 0x4b, 0x03, 0x04]; // PK..: zip
const MB = 1024 * 1024;

describe('InboundService.downloadAttachment', () => {
  it('acepta JPEG bajo 5 MB con nombre estable', async () => {
    const { svc } = setup(file('image/jpeg', 100));
    const a = await svc.downloadAttachment(msg());
    expect(a).toMatchObject({
      name: 'wa_wamid.X_.jpg',
      mimeType: 'image/jpeg',
    });
    expect(attachmentName('wamid.X=', 'image/jpeg')).toBe(a!.name);
  });

  it('acepta PDF de hasta 10 MB', async () => {
    const { svc } = setup(file('application/pdf', 6 * MB));
    expect(
      (await svc.downloadAttachment(msg({ type: 'document' })))?.name,
    ).toMatch(/\.pdf$/);
  });

  it.each([
    ['tipo no soportado', file('application/zip', 10)],
    ['imagen > 5 MB', file('image/png', 5 * MB + 1)],
    ['PDF > 10 MB', file('application/pdf', 10 * MB + 1)],
    ['fallo de descarga', null],
    ['docx renombrado a .png', file('image/png', 100, DOCX_HEAD)],
    ['PDF que no es PDF', file('application/pdf', 100, DOCX_HEAD)],
    ['HEIC sin marca ftyp', file('image/heic', 100, DOCX_HEAD)],
  ])('rechaza: %s', async (_n, media) => {
    const { svc } = setup(media);
    expect(await svc.downloadAttachment(msg())).toBeNull();
  });

  it('convierte HEIC a JPEG', async () => {
    convertMock.mockResolvedValueOnce(new Uint8Array([0xff, 0xd8, 0xff]));
    const { svc } = setup(file('image/heic', 100, HEIC_HEAD));
    const a = await svc.downloadAttachment(msg());
    expect(a).toMatchObject({
      name: 'wa_wamid.X_.jpg',
      mimeType: 'image/jpeg',
    });
    expect(a!.data).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it('rechaza HEIC si la conversión falla', async () => {
    convertMock.mockRejectedValueOnce(new Error('corrupto'));
    const { svc } = setup(file('image/heic', 100, HEIC_HEAD));
    expect(await svc.downloadAttachment(msg())).toBeNull();
  });
});

describe('InboundService.downloadAttachment (tope previo)', () => {
  it('pasa a getMedia un tope por mime: 5 MB imágenes, 10 MB PDF, 0 el resto', async () => {
    const { svc, getMedia } = setup(file('image/jpeg', 1));
    await svc.downloadAttachment(msg());
    const limit = (getMedia.mock.calls[0] as unknown[])[1] as (
      m: string,
    ) => number;
    expect([
      limit('image/png'),
      limit('application/pdf'),
      limit('application/zip'),
    ]).toEqual([5 * MB, 10 * MB, 0]);
  });
});

describe('InboundService.resolveReplyContext', () => {
  it('devuelve el texto del mensaje citado conocido', async () => {
    const { svc, messages } = setup(null, { content: 'tu ticket' });
    expect(await svc.resolveReplyContext(msg({ replyToWamid: 'w0' }))).toBe(
      'tu ticket',
    );
    expect(messages.findOne).toHaveBeenCalledWith({ where: { wamid: 'w0' } });
  });

  it('null si el citado es desconocido o no hay cita', async () => {
    const { svc } = setup(null, null);
    expect(
      await svc.resolveReplyContext(msg({ replyToWamid: 'w0' })),
    ).toBeNull();
    expect(await svc.resolveReplyContext(msg())).toBeNull();
  });
});
