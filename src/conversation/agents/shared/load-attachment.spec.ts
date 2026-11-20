import { loadAttachment } from './load-attachment';

describe('loadAttachment', () => {
  it('devuelve bytes y mime de un artifact presente', async () => {
    const ctx: any = {
      loadArtifact: () =>
        Promise.resolve({
          inlineData: {
            data: Buffer.from('FOTO').toString('base64'),
            mimeType: 'image/png',
          },
        }),
    };
    const r = await loadAttachment(ctx, 'wa_1.png');
    expect(r).toMatchObject({ available: true, mimeType: 'image/png' });
    expect(r.available && r.bytes.toString()).toBe('FOTO');
  });

  it('nombre desconocido o error: no disponible, sin lanzar', async () => {
    const missing: any = { loadArtifact: () => Promise.resolve(undefined) };
    const broken: any = { loadArtifact: () => Promise.reject(new Error('x')) };
    expect((await loadAttachment(missing, 'nada.jpg')).available).toBe(false);
    expect((await loadAttachment(broken, 'nada.jpg')).available).toBe(false);
  });
});
