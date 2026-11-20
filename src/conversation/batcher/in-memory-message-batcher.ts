import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BatchHandler,
  BatchItem,
  DEFAULT_BATCH_QUIET_MS,
  MessageBatcher,
} from './message-batcher';

interface ContactState {
  buffer: BatchItem[];
  timer?: NodeJS.Timeout;
  running: boolean;
  /** Llegó un `immediate` durante la corrida: al terminar se procesa sin esperar. */
  urgent: boolean;
}

/**
 * ponytail: estado sólo en memoria y una instancia; un reinicio pierde el buffer (los mensajes ya están en el log).
 * Mejora: implementación con Redis/BullMQ del mismo contrato si hay varias instancias.
 */
@Injectable()
export class InMemoryMessageBatcher extends MessageBatcher {
  private readonly logger = new Logger(InMemoryMessageBatcher.name);
  private readonly contacts = new Map<string, ContactState>();
  private readonly quietMs: number;
  private handler?: BatchHandler;

  constructor(config: ConfigService) {
    super();
    const quiet = Number(config.get('BATCH_QUIET_MS'));
    this.quietMs = quiet > 0 ? quiet : DEFAULT_BATCH_QUIET_MS;
  }

  onBatch(handler: BatchHandler) {
    this.handler = handler;
  }

  submit(contactId: string, item: BatchItem, opts?: { immediate?: boolean }) {
    let c = this.contacts.get(contactId);
    if (!c) {
      c = { buffer: [], running: false, urgent: false };
      this.contacts.set(contactId, c);
    }
    c.buffer.push(item);
    clearTimeout(c.timer);
    if (!opts?.immediate) return this.arm(contactId, c);
    if (c.running) c.urgent = true;
    else void this.run(contactId, c);
  }

  /** Debounce rodante: cada mensaje reinicia el periodo de silencio. */
  private arm(contactId: string, c: ContactState) {
    clearTimeout(c.timer);
    c.timer = setTimeout(() => {
      // si hay corrida activa, su `finally` arma un periodo nuevo para lo acumulado
      if (!c.running && this.contacts.get(contactId) === c)
        void this.run(contactId, c);
    }, this.quietMs);
    c.timer.unref();
  }

  private async run(contactId: string, c: ContactState) {
    // Un timer pendiente ya no tiene nada que vaciar: su lote sale en esta corrida.
    clearTimeout(c.timer);
    const items = c.buffer.splice(0);
    if (!items.length) return;
    c.running = true;
    c.urgent = false;
    try {
      await this.handler?.(contactId, items);
    } catch (err) {
      this.logger.error(
        `Lote de ${contactId} falló: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      c.running = false;
      if (!c.buffer.length) this.contacts.delete(contactId);
      else if (c.urgent) void this.run(contactId, c);
      else this.arm(contactId, c);
    }
  }
}
