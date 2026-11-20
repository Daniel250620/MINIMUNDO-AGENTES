import { createHmac } from 'crypto';
import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { MetaSignatureGuard } from './meta-signature.guard';

const SECRET = 'app-secret';
const body = Buffer.from('{"object":"whatsapp_business_account"}');
const sign = (b: Buffer, secret = SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(b).digest('hex');

const ctx = (headers: Record<string, string>, rawBody: Buffer | undefined) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers, rawBody }) }),
  }) as unknown as ExecutionContext;

describe('MetaSignatureGuard', () => {
  const guard = new MetaSignatureGuard();
  beforeEach(() => (process.env.WHATSAPP_APP_SECRET = SECRET));
  afterAll(() => delete process.env.WHATSAPP_APP_SECRET);

  it('acepta una firma válida', () => {
    expect(
      guard.canActivate(ctx({ 'x-hub-signature-256': sign(body) }, body)),
    ).toBe(true);
  });

  it('rechaza sin cabecera de firma', () => {
    expect(() => guard.canActivate(ctx({}, body))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza una firma de otro secreto', () => {
    const header = { 'x-hub-signature-256': sign(body, 'otro') };
    expect(() => guard.canActivate(ctx(header, body))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza si el cuerpo fue alterado', () => {
    const header = { 'x-hub-signature-256': sign(body) };
    expect(() =>
      guard.canActivate(ctx(header, Buffer.from('{"alterado":true}'))),
    ).toThrow(UnauthorizedException);
  });

  it('rechaza todo si no hay secreto configurado', () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const header = { 'x-hub-signature-256': sign(body) };
    expect(() => guard.canActivate(ctx(header, body))).toThrow(
      UnauthorizedException,
    );
  });
});
