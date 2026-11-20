import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizePhone } from '../../common/normalize-phone.util';
import { MessageInterface } from '../../whatsapp/interfaces/message-interface';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import {
  ConversationMessage,
  type MessageMedia,
} from '../entities/conversation-message.entity';
import { ERROR_REPLY } from '../replies';
import { OutboundMessage, outboundToText } from './outbound-message';
import { validateOutbound } from './validate-outbound';

/** Referencia del adjunto saliente para el panel; `undefined` si el mensaje no lleva archivo. */
const toMedia = (msg: OutboundMessage): MessageMedia | undefined => {
  if (msg.kind === 'image') return { kind: 'image', url: msg.url };
  const doc =
    msg.kind === 'document' ? msg : msg.kind === 'buttons' && msg.document;
  if (doc)
    return {
      kind: 'document',
      mediaId: doc.mediaId,
      url: doc.url,
      filename: doc.filename,
    };
};

/** Valida, envía y registra en el log cualquier OutboundMessage; no sabe qué tool lo produjo. */
@Injectable()
export class OutboundDispatcher {
  private readonly logger = new Logger(OutboundDispatcher.name);

  constructor(
    private readonly whatsapp: WhatsappService,
    @InjectRepository(ConversationMessage)
    private readonly messages: Repository<ConversationMessage>,
  ) {}

  /** true si Meta aceptó el mensaje; uno que no salió se loguea y no se registra como enviado. */
  async send(to: string, msg: OutboundMessage) {
    try {
      validateOutbound(msg);
    } catch (err) {
      this.logger.error(`${(err as Error).message} (to=${to})`);
      msg = { kind: 'text', text: ERROR_REPLY };
    }
    const res = await this.whatsapp.sendMessage(this.toWhatsapp(to, msg));
    const wamid = res?.messages?.[0]?.id;
    if (!wamid) {
      // sendMessage no lanza: devuelve el JSON de error de Meta, o undefined si falló la red
      this.logger.error(
        `Envío fallido a ${to}: ${res?.error?.code ?? 'sin respuesta'} ${res?.error?.message ?? ''}`,
      );
      return false;
    }
    await this.messages.save(
      this.messages.create({
        phone: normalizePhone(to),
        direction: 'out',
        content: outboundToText(msg),
        wamid,
        media: toMedia(msg),
      }),
    );
    return true;
  }

  /** "Escribiendo" + leído para el último mensaje del lote; best effort, no se registra en el log. */
  typing(wamid: string) {
    return this.whatsapp.sendTyping(wamid);
  }

  private toWhatsapp(to: string, msg: OutboundMessage): MessageInterface {
    switch (msg.kind) {
      case 'text':
        return { to, textBody: msg.text };
      case 'buttons':
        return {
          to,
          textBody: msg.text,
          buttons: msg.buttons,
          headerDocument: msg.document,
        };
      case 'list':
        return {
          to,
          textBody: msg.text,
          list: { buttonLabel: msg.buttonLabel, rows: msg.rows },
        };
      case 'image':
        return { to, imageUrl: msg.url, caption: msg.caption };
      case 'document':
        return {
          to,
          documentUrl: msg.url,
          documentMediaId: msg.mediaId,
          documentFilename: msg.filename,
          caption: msg.caption,
        };
    }
  }
}
