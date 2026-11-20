import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import convertHeic from 'heic-convert';
import { sniffKind } from '../../common/sniff-kind';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { ConversationMessage } from '../entities/conversation-message.entity';
import type { Attachment, IncomingMessage } from './incoming-message';

const MB = 1024 * 1024;
/** mime aceptado → extensión y tope de tamaño. HEIC/HEIF se guardan como JPEG, por eso `jpg`. */
const ACCEPTED: Record<string, { ext: string; maxBytes: number }> = {
  'image/jpeg': { ext: 'jpg', maxBytes: 5 * MB },
  'image/png': { ext: 'png', maxBytes: 5 * MB },
  'image/webp': { ext: 'webp', maxBytes: 5 * MB },
  'image/heic': { ext: 'jpg', maxBytes: 5 * MB },
  'image/heif': { ext: 'jpg', maxBytes: 5 * MB },
  'application/pdf': { ext: 'pdf', maxBytes: 10 * MB },
};

const HEIF_BRANDS = ['heic', 'heix', 'mif1', 'msf1'];
const isHeif = (b: Buffer) =>
  b.toString('latin1', 4, 8) === 'ftyp' &&
  HEIF_BRANDS.includes(b.toString('latin1', 8, 12));

/** Nombre estable derivado del wamid y el tipo; el wamid se sanea porque acaba en nombre de artifact. */
export function attachmentName(wamid: string, mimeType: string) {
  return `wa_${wamid.replace(/[^\w.-]/g, '_')}.${ACCEPTED[mimeType]?.ext ?? 'bin'}`;
}

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    @InjectRepository(ConversationMessage)
    private readonly messages: Repository<ConversationMessage>,
  ) {}

  /** Texto del mensaje citado, o null si no hay cita o no está en el log. */
  async resolveReplyContext(msg: IncomingMessage): Promise<string | null> {
    if (!msg.replyToWamid) return null;
    const quoted = await this.messages.findOne({
      where: { wamid: msg.replyToWamid },
    });
    return quoted?.content ?? null;
  }

  /** Descarga y valida el adjunto; null si no se pudo bajar o no cumple tipo/tamaño. */
  async downloadAttachment(msg: IncomingMessage): Promise<Attachment | null> {
    const media = await this.whatsapp.getMedia(
      msg.mediaId!,
      (mime) => ACCEPTED[mime]?.maxBytes ?? 0,
    );
    if (!media) {
      this.logger.warn(`Descarga fallida wamid=${msg.wamid}`);
      return null;
    }
    const rule = ACCEPTED[media.mimeType];
    if (!rule || media.buffer.length > rule.maxBytes) {
      this.logger.warn(
        `Adjunto rechazado wamid=${msg.wamid} mime=${media.mimeType} bytes=${media.buffer.length}`,
      );
      return null;
    }
    // QR, OCR y Gemini no leen HEIC: se convierte aquí para que todo lo demás reciba JPEG.
    if (media.mimeType === 'image/heic' || media.mimeType === 'image/heif') {
      const jpeg = isHeif(media.buffer)
        ? await convertHeic({
            buffer: media.buffer,
            format: 'JPEG',
            quality: 0.9,
          })
            .then((out) => Buffer.from(out))
            .catch(() => null)
        : null;
      if (!jpeg) {
        this.logger.warn(`HEIC inválido wamid=${msg.wamid}`);
        return null;
      }
      return {
        name: attachmentName(msg.wamid, media.mimeType),
        mimeType: 'image/jpeg',
        data: jpeg,
      };
    }
    // El mime viene de la extensión: un .docx renombrado a .png llega como image/png.
    const declared = media.mimeType === 'application/pdf' ? 'pdf' : 'image';
    if (sniffKind(media.buffer) !== declared) {
      this.logger.warn(
        `Contenido no coincide con mime wamid=${msg.wamid} mime=${media.mimeType}`,
      );
      return null;
    }
    return {
      name: attachmentName(msg.wamid, media.mimeType),
      mimeType: media.mimeType,
      data: media.buffer,
    };
  }
}
