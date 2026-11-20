import type { Attachment, IncomingMessage } from '../inbound/incoming-message';

/** Elemento de un lote: el mensaje y, si traía archivo, el adjunto ya descargado. */
export interface BatchItem {
  msg: IncomingMessage;
  attachment?: Attachment;
}

export type BatchHandler = (
  contactId: string,
  items: BatchItem[],
) => Promise<void>;

/**
 * Agrupa los mensajes de un contacto en un turno y garantiza una sola corrida activa por contacto.
 * Clase abstracta para usarla como token de inyección: una versión con Redis la reemplaza sin tocar a los llamadores.
 */
export abstract class MessageBatcher {
  /** `immediate` (botones/listas) salta el periodo de silencio, pero respeta la corrida activa. */
  abstract submit(
    contactId: string,
    item: BatchItem,
    opts?: { immediate?: boolean },
  ): void;

  /** Se registra una sola vez; nunca debe lanzar hacia el batcher (si lanza, se loguea y se libera al contacto). */
  abstract onBatch(handler: BatchHandler): void;
}

export const DEFAULT_BATCH_QUIET_MS = 7000;
