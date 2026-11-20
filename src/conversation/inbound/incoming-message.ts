/** Mensaje de WhatsApp ya normalizado, independiente de la forma del payload de Meta. */
export interface IncomingMessage {
  from: string;
  wamid: string;
  contactName: string | null;
  type:
    'text' | 'image' | 'document' | 'location' | 'interactive' | 'unsupported';
  /** `type` original de Meta (útil cuando `type` es 'unsupported'). */
  rawType: string;
  /** Texto, caption, título de la opción elegida o representación de la ubicación. */
  text: string | null;
  /** wamid del mensaje citado, si lo hay. */
  replyToWamid: string | null;
  /** id de media de Meta (image/document); la descarga es aparte. */
  mediaId?: string;
  filename?: string;
  /** Botón o fila elegidos: el id sirve al flujo, el título lo lee el agente. */
  selection?: { id: string; title: string };
  location?: { latitude: number; longitude: number };
  /** `errors` de Meta en mensajes no soportados, sólo para diagnóstico. */
  errors?: unknown[];
}

/** Archivo ya descargado y validado. */
export interface Attachment {
  /** Nombre estable `wa_<wamid>.<ext>`: lo ve el modelo y es la llave del artifact. */
  name: string;
  mimeType: string;
  data: Buffer;
}
