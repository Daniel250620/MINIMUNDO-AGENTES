import { createHmac, timingSafeEqual } from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

/** Valida `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo crudo con el app secret de Meta). Sin secreto configurado, rechaza todo. */
@Injectable()
export class MetaSignatureGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const secret = process.env.WHATSAPP_APP_SECRET;
    const header = req.headers['x-hub-signature-256'];
    if (!secret || typeof header !== 'string' || !req.rawBody)
      throw new UnauthorizedException('Firma inválida');

    const expected = Buffer.from(
      'sha256=' +
        createHmac('sha256', secret).update(req.rawBody).digest('hex'),
    );
    const received = Buffer.from(header);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new UnauthorizedException('Firma inválida');
    return true;
  }
}
