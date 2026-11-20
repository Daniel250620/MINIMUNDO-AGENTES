import { Injectable, Logger } from '@nestjs/common';
import { MessageInterface } from './interfaces/message-interface';

const MEDIA_TIMEOUT_MS = 30_000;
const TYPING_GRAPH_VERSION = 'v23.0';

/** Respuesta de Meta al enviar: `messages` si salió, `error` si la rechazó. */
export interface WhatsappSendResponse {
  messages?: { id: string }[];
  error?: { code?: number; message?: string };
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_ID;

  async sendMessage(
    data: MessageInterface,
  ): Promise<WhatsappSendResponse | undefined> {
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.WHATSAPP_TOKEN}`,
    };

    const isImage = Boolean(data.imageUrl);
    const isDocument = Boolean(data.documentUrl || data.documentMediaId);
    const isButtons = Boolean(data.buttons?.length) && !isImage && !isDocument;
    const isList = Boolean(data.list) && !isImage && !isDocument && !isButtons;
    const isText =
      Boolean(data.textBody) &&
      !isImage &&
      !isDocument &&
      !isButtons &&
      !isList;
    const isInteractive = Boolean(data?.flowId) && !isImage && !isDocument;
    const type = isImage
      ? 'image'
      : isDocument
        ? 'document'
        : isText
          ? 'text'
          : isButtons || isList || isInteractive
            ? 'interactive'
            : 'template';
    const body: Record<string, unknown> = {
      recipient_type: 'individual',
      messaging_product: 'whatsapp',
      to: data.to,
      type,
      ...(isImage && {
        image: {
          link: data.imageUrl,
          ...(data.caption && { caption: data.caption }),
        },
      }),
      ...(isDocument && {
        document: {
          ...(data.documentMediaId
            ? { id: data.documentMediaId }
            : { link: data.documentUrl }),
          caption: data.caption ?? 'Tu factura electrónica',
          filename: data.documentFilename ?? 'Factura.pdf',
        },
      }),
      ...(isText && { text: { body: data.textBody } }),
      ...(data.template && !isText && !isImage && { ...data.template }),
      ...(isButtons && {
        interactive: {
          type: 'button',
          ...(data.headerDocument && {
            header: {
              type: 'document',
              document: {
                ...(data.headerDocument.mediaId
                  ? { id: data.headerDocument.mediaId }
                  : { link: data.headerDocument.url }),
                filename: data.headerDocument.filename,
              },
            },
          }),
          body: { text: data.textBody },
          action: {
            buttons: data.buttons!.map(({ id, title }) => ({
              type: 'reply',
              reply: { id, title },
            })),
          },
        },
      }),
      ...(isList && {
        interactive: {
          type: 'list',
          body: { text: data.textBody },
          action: {
            button: data.list!.buttonLabel,
            sections: [{ rows: data.list!.rows }],
          },
        },
      }),
      ...(isInteractive &&
        !isButtons &&
        !isList && {
          interactive: {
            body: { text: data.bodyText },
            footer: { text: 'Powered by Karimnot' },
            type: 'flow',
            action: {
              name: 'flow',
              parameters: {
                flow_message_version: '3',
                flow_id: data.flowId,
                flow_cta: data.flowCta,
              },
            },
          },
        }),
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });
      const responseData = (await response.json()) as WhatsappSendResponse;

      return responseData;
    } catch (error) {
      this.logger.error('Error sending WhatsApp message:', error);
    }
  }

  /**
   * Muestra "escribiendo" al contacto y marca como leído su mensaje `wamid` (Meta lo apaga al responder o a ~25 s).
   * Best effort: devuelve false y loguea si falla; nunca lanza.
   */
  async sendTyping(wamid: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${TYPING_GRAPH_VERSION}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.WHATSAPP_TOKEN}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: wamid,
            typing_indicator: { type: 'text' },
          }),
        },
      );
      if (!response.ok) {
        this.logger.warn(
          `[sendTyping] Meta rechazó wamid=${wamid} status=${response.status} ${await response.text().catch(() => '')}`,
        );
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`[sendTyping] ${(err as Error).message}`);
      return false;
    }
  }

  /** Obtiene una imagen recibida por WhatsApp como base64 para procesarla (ej. Vision) */
  async getMediaAsBase64(mediaId: string): Promise<string | null> {
    const media = await this.getMedia(mediaId);
    return media ? media.buffer.toString('base64') : null;
  }

  /**
   * Sube un archivo a la media de WhatsApp y devuelve su `id`, para enviarlo sin alojarlo en otro lado.
   * Lanza si Meta lo rechaza o no responde; nunca registra el contenido.
   */
  async uploadMedia(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      filename,
    );
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${this.phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.WHATSAPP_TOKEN}` },
        body: form,
        signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
      },
    );
    const data = (await res.json().catch(() => undefined)) as
      { id?: string } | undefined;
    if (!res.ok || !data?.id)
      throw new Error(`Meta rechazó la subida de media (HTTP ${res.status})`);
    return data.id;
  }

  /**
   * Obtiene un archivo recibido por WhatsApp (imagen, PDF, etc.).
   * Devuelve buffer y mimeType (sin parámetros, en minúsculas); null si falla algo o excede `maxBytes`.
   * `maxBytes` puede depender del mime (`<= 0` rechaza el tipo); se comprueba contra `file_size` de la metadata
   * y `Content-Length` antes de bajar el cuerpo, y de nuevo contra lo recibido.
   */
  async getMedia(
    mediaId: string,
    maxBytes?: number | ((mimeType: string) => number),
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const init = () => ({
      headers: { Authorization: `Bearer ${this.WHATSAPP_TOKEN}` },
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    });
    try {
      const metaRes = await fetch(
        `https://graph.facebook.com/v18.0/${mediaId}`,
        init(),
      );
      const meta = (await metaRes.json()) as {
        url?: string;
        mime_type?: string;
        file_size?: number;
        error?: unknown;
      };
      if (!metaRes.ok || !meta.url) {
        this.logger.warn(
          `[getMedia] meta sin url para mediaId=${mediaId}: ${JSON.stringify(meta)}`,
        );
        return null;
      }
      const mimeType = (meta.mime_type ?? 'application/octet-stream')
        .split(';')[0]
        .trim()
        .toLowerCase();
      const max =
        typeof maxBytes === 'function' ? maxBytes(mimeType) : maxBytes;
      const tooBig = (size: number) =>
        max !== undefined && (max <= 0 || size > max);
      if (tooBig(meta.file_size ?? 0)) {
        this.logger.warn(
          `[getMedia] rechazado antes de bajar mediaId=${mediaId} mime=${mimeType} size=${meta.file_size}`,
        );
        return null;
      }
      const fileRes = await fetch(meta.url, init());
      if (
        !fileRes.ok ||
        tooBig(Number(fileRes.headers.get('content-length')))
      ) {
        this.logger.warn(
          `[getMedia] descarga rechazada mediaId=${mediaId} status=${fileRes.status}`,
        );
        return null;
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      if (tooBig(buffer.length)) return null;
      this.logger.debug(
        `[getMedia] Descargado ${buffer.length} bytes, mime=${mimeType}`,
      );
      return { buffer, mimeType };
    } catch (err) {
      this.logger.error('[getMedia]', (err as Error).message);
      return null;
    }
  }
}
