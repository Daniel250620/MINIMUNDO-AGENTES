/** Payload entrante de la Cloud API de Meta (sólo lo que usamos), tipado por `type`. */
interface BaseMessage {
  from: string;
  id: string;
  /** Presente cuando el cliente responde citando un mensaje. */
  context?: { id?: string };
}

export type WhatsappMessage =
  | (BaseMessage & { type: 'text'; text: { body: string } })
  | (BaseMessage & {
      type: 'image';
      image: { id: string; mime_type?: string; caption?: string };
    })
  | (BaseMessage & {
      type: 'document';
      document: {
        id: string;
        mime_type?: string;
        caption?: string;
        filename?: string;
      };
    })
  | (BaseMessage & {
      type: 'location';
      location: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
      };
    })
  | (BaseMessage & {
      type: 'interactive';
      interactive:
        | {
            type: 'button_reply';
            button_reply: { id: string; title: string };
          }
        | {
            type: 'list_reply';
            list_reply: { id: string; title: string; description?: string };
          }
        | { type: 'nfm_reply' };
    })
  /** Toque de un botón de respuesta rápida de una plantilla. */
  | (BaseMessage & {
      type: 'button';
      button: { payload: string; text: string };
    })
  | (BaseMessage & {
      type:
        | 'audio'
        | 'video'
        | 'sticker'
        | 'reaction'
        | 'contacts'
        | 'order'
        | 'system'
        | 'unsupported';
      /** Meta explica aquí por qué marcó el mensaje como `unsupported`. */
      errors?: unknown[];
    });

export interface WhatsappWebhookBody {
  entry?: {
    changes?: {
      value?: {
        messages?: WhatsappMessage[];
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        // statuses (entregado/leído) llegan sin `messages`: se ignoran
        statuses?: unknown[];
      };
    }[];
  }[];
}
