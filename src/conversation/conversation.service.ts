import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InMemoryArtifactService } from '@google/adk';
import { Repository } from 'typeorm';
import { normalizePhone } from '../common/normalize-phone.util';
import { MessageBatcher, type BatchItem } from './batcher/message-batcher';
import { APP_NAME, SessionEntity } from './entities/adk-session.entity';
import { ConversationMessage } from './entities/conversation-message.entity';
import type { IncomingMessage } from './inbound/incoming-message';
import { InboundService } from './inbound/inbound.service';
import { parseWebhook } from './inbound/parse-webhook';
import type { WhatsappWebhookBody } from './inbound/whatsapp-payload';
import { OutboundDispatcher } from './outbound/outbound.dispatcher';
import { ERROR_REPLY, GOODBYE_REPLY, UNSUPPORTED_REPLY } from './replies';
import { withReplyContext } from './reply-context';
import { AgentRunner } from './runner/agent-runner';
import { buildTurn, saveAttachments } from './runner/build-turn';
import { TypeOrmSessionService } from './session/typeorm-session.service';
import { withUserLock } from './session/user-lock';

/** Palabras que borran la sesión del cliente (ya normalizadas). */
const RESET_WORDS = new Set(['adios']);
const isResetWord = (text?: string | null) =>
  !!text &&
  RESET_WORDS.has(
    text
      .normalize('NFD')
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase(),
  );
const isUniqueViolation = (err: unknown) =>
  (err as { code?: string }).code === '23505';

/** Orquestación delgada: recepción → batcher → lock → runner → envío. */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(ConversationMessage)
    private readonly messages: Repository<ConversationMessage>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    private readonly sessionService: TypeOrmSessionService,
    private readonly inbound: InboundService,
    private readonly batcher: MessageBatcher,
    private readonly runner: AgentRunner,
    private readonly dispatcher: OutboundDispatcher,
    private readonly artifacts: InMemoryArtifactService,
  ) {
    this.batcher.onBatch((userId, items) => this.processBatch(userId, items));
  }

  /** Procesa en orden todos los mensajes del payload; un mensaje que falla no frena a los demás. */
  async handleWebhook(body: WhatsappWebhookBody) {
    for (const msg of parseWebhook(body)) {
      this.logger.log(`[WEBHOOK] type=${msg.rawType}, from=${msg.from}`);
      try {
        await this.handleMessage(msg);
      } catch (err) {
        this.logger.error(
          `Mensaje ${msg.wamid} falló: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async handleMessage(msg: IncomingMessage) {
    const phone = normalizePhone(msg.from);
    const isNew = await this.saveMessage(msg, phone);
    if (!isNew) return; // reenvío de Meta

    const session = await this.resolveSession(msg.from, phone, msg.contactName);
    if (!session.isBotActive) return;

    const notice = (text: string) =>
      this.dispatcher.send(msg.from, { kind: 'text', text });
    // Meta manda un `unsupported` extra al agrupar fotos en álbum; sus fotos llegan aparte.
    if (msg.rawType === 'unsupported') return;
    if (msg.type === 'unsupported') return notice(UNSUPPORTED_REPLY);

    if (msg.type === 'text' && isResetWord(msg.text)) {
      await withUserLock(msg.from, () =>
        this.sessionService.deleteUserSessions(msg.from),
      );
      return notice(GOODBYE_REPLY);
    }

    // La descarga va al recibir, no al flush, para que el debounce no la atrase.
    let attachment: BatchItem['attachment'];
    if (msg.mediaId) {
      attachment = (await this.inbound.downloadAttachment(msg)) ?? undefined;
      if (!attachment) return notice(UNSUPPORTED_REPLY);
      await this.messages.update(
        { wamid: msg.wamid },
        {
          attachmentName: attachment.name,
          attachmentMime: attachment.mimeType,
        },
      );
    }

    const quoted = await this.inbound.resolveReplyContext(msg);
    const text = withReplyContext(quoted, msg.text);
    // Botones y listas saltan el periodo de silencio.
    this.batcher.submit(
      msg.from,
      { msg: { ...msg, text }, attachment },
      { immediate: msg.type === 'interactive' },
    );
  }

  private processBatch(userId: string, items: BatchItem[]) {
    return withUserLock(userId, () => this.runBatch(userId, items));
  }

  private async runBatch(userId: string, items: BatchItem[]) {
    // El bot pudo desactivarse durante el periodo de silencio (toma de control humana).
    const session = await this.sessions.findOne({
      where: { appName: APP_NAME, userId, adkSessionId: userId },
    });
    if (!session?.isBotActive) return;

    // Best effort: una falla del indicador de "escribiendo" no debe alterar el turno.
    const lastWamid = items.at(-1)?.msg.wamid;
    if (lastWamid)
      void Promise.resolve()
        .then(() => this.dispatcher.typing(lastWamid))
        .catch((e: Error) =>
          this.logger.warn(`Typing de ${userId}: ${e.message}`),
        );

    try {
      const { content, attachments } = buildTurn(items);
      await saveAttachments(this.artifacts, userId, userId, attachments);
      const { answer, outbound } = await this.runner.run({
        userId,
        sessionId: userId,
        content,
        turn: randomUUID(),
        files: attachments.length,
      });
      await this.dispatcher.send(
        userId,
        outbound ?? { kind: 'text', text: answer || ERROR_REPLY },
      );
    } catch (err) {
      // Último recurso: el cliente recibe la disculpa y el lock se libera al salir.
      this.logger.error(
        `Lote de ${userId} falló: ${(err as Error).message}`,
        (err as Error).stack,
      );
      await this.dispatcher
        .send(userId, { kind: 'text', text: ERROR_REPLY })
        .catch((e: Error) =>
          this.logger.error(`Disculpa a ${userId} no enviada: ${e.message}`),
        );
    }
  }

  /** false si el wamid ya existía (violación de unicidad = duplicado). */
  private async saveMessage(msg: IncomingMessage, phone: string) {
    try {
      await this.messages.save(
        this.messages.create({
          phone,
          direction: 'in',
          content: msg.text ?? `[${msg.rawType}]`,
          wamid: msg.wamid,
          // la referencia va en el mismo save, aunque luego falle la descarga
          media:
            msg.mediaId && (msg.type === 'image' || msg.type === 'document')
              ? { kind: msg.type, mediaId: msg.mediaId, filename: msg.filename }
              : null,
        }),
      );
      return true;
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }

  private async resolveSession(
    userId: string,
    phone: string,
    name?: string | null,
  ) {
    const where = { appName: APP_NAME, userId, adkSessionId: userId };
    const found = await this.sessions.findOne({ where });
    if (found) return found;
    try {
      await this.sessionService.createSession({
        appName: APP_NAME,
        userId,
        sessionId: userId,
        state: { phone, customerName: name ?? null },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // la creó otro webhook simultáneo
    }
    return (await this.sessions.findOne({ where }))!;
  }
}
