import { InMemoryArtifactService } from '@google/adk';
import type { BatchItem } from '../batcher/message-batcher';
import { buildTurn, saveAttachments } from './build-turn';

const att = (name: string, mimeType: string, data = 'ABC') => ({
  name,
  mimeType,
  data: Buffer.from(data),
});
const items: BatchItem[] = [
  {
    msg: { text: 'mi ticket' } as any,
    attachment: att('wa_1.jpg', 'image/jpeg'),
  },
  {
    msg: { text: 'y mi csf' } as any,
    attachment: att('wa_2.pdf', 'application/pdf'),
  },
  { msg: { text: 'gracias' } as any },
];

describe('buildTurn', () => {
  it('una parte de texto con notas en orden y un inlineData por adjunto', () => {
    const { content, attachments } = buildTurn(items);
    expect(content.role).toBe('user');
    expect(content.parts![0].text).toBe(
      [
        'mi ticket',
        '[Archivo adjunto: wa_1.jpg (image/jpeg)]',
        'y mi csf',
        '[Archivo adjunto: wa_2.pdf (application/pdf)]',
        'gracias',
      ].join('\n'),
    );
    expect(content.parts!.slice(1).map((p) => p.inlineData?.mimeType)).toEqual([
      'image/jpeg',
      'application/pdf',
    ]);
    expect(content.parts![1].inlineData!.data).toBe(
      Buffer.from('ABC').toString('base64'),
    );
    expect(attachments).toHaveLength(2);
  });

  it('sólo texto: una sola parte', () => {
    const { content } = buildTurn([{ msg: { text: 'hola' } as any }]);
    expect(content.parts).toEqual([{ text: 'hola' }]);
  });
});

describe('saveAttachments', () => {
  it('guarda cada adjunto en la sesión del router bajo su nombre', async () => {
    const svc = new InMemoryArtifactService();
    await saveAttachments(svc, '52', '52', [att('wa_1.jpg', 'image/jpeg')]);
    const part = await svc.loadArtifact({
      appName: 'minimundo-assistant',
      userId: '52',
      sessionId: '52',
      filename: 'wa_1.jpg',
    });
    expect(part?.inlineData?.mimeType).toBe('image/jpeg');
  });
});
