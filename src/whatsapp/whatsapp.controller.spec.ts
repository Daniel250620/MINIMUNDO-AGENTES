import { HttpException } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';

describe('WhatsappController GET webhook (verificación de Meta)', () => {
  const controller = new WhatsappController({} as never);
  beforeAll(() => (process.env.WHATSAPP_VERIFY_TOKEN = 'verify-me'));
  afterAll(() => delete process.env.WHATSAPP_VERIFY_TOKEN);

  it('con token correcto devuelve el challenge', () => {
    expect(
      controller.webhook({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'verify-me',
        'hub.challenge': '12345',
      }),
    ).toBe('12345');
  });

  it('con token incorrecto responde 403', () => {
    try {
      controller.webhook({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'otro',
        'hub.challenge': '12345',
      });
      fail('debió lanzar');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
    }
  });
});
