/** Único contrato de salida hacia WhatsApp; el discriminante `kind` también lo identifica en los resultados de tools. */
export type OutboundMessage =
  | { kind: 'text'; text: string }
  | {
      kind: 'buttons';
      text: string;
      buttons: { id: string; title: string }[];
      /** Documento como encabezado del mensaje interactivo (una sola burbuja: PDF + texto + botones). */
      document?: { url?: string; mediaId?: string; filename: string };
    }
  | {
      kind: 'list';
      text: string;
      /** Etiqueta del botón que abre el menú. */
      buttonLabel: string;
      rows: { id: string; title: string; description?: string }[];
    }
  | { kind: 'image'; url: string; caption?: string }
  | {
      kind: 'document';
      url?: string;
      mediaId?: string;
      filename: string;
      caption?: string;
    };

const KINDS = ['text', 'buttons', 'list', 'image', 'document'];

export function isOutboundMessage(value: unknown): value is OutboundMessage {
  const kind = (value as { kind?: unknown } | null)?.kind;
  return typeof kind === 'string' && KINDS.includes(kind);
}

/** Representación en texto para el log de conversación. */
export function outboundToText(msg: OutboundMessage): string {
  switch (msg.kind) {
    case 'text':
      return msg.text;
    case 'buttons':
      return `${msg.document ? `[documento: ${msg.document.filename}]\n` : ''}${msg.text}\n[${msg.buttons.map((b) => b.title).join(' | ')}]`;
    case 'list':
      return `${msg.text}\n[${msg.rows.map((r) => r.title).join(' | ')}]`;
    case 'image':
      return msg.caption ?? '[imagen]';
    case 'document':
      return msg.caption ?? `[documento: ${msg.filename}]`;
  }
}
