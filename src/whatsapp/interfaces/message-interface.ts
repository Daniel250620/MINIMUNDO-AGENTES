export interface MessageInterface {
  to: string;
  /** Plain text message (WhatsApp type: text) */
  textBody?: string;
  /** Image message: URL must be publicly accessible */
  imageUrl?: string;
  /** Document message (e.g. PDF): URL must be accessible by WhatsApp */
  documentUrl?: string;
  /** Alternativa a `documentUrl`: id de un archivo ya subido a la media de WhatsApp */
  documentMediaId?: string;
  documentFilename?: string;
  caption?: string;
  /** Quick-reply buttons (máx. 3, título ≤ 20 chars) con `textBody` como cuerpo */
  buttons?: { id: string; title: string }[];
  /** Documento como encabezado del mensaje de botones (`buttons`) */
  headerDocument?: { url?: string; mediaId?: string; filename: string };
  /** Lista interactiva con `textBody` como cuerpo */
  list?: {
    buttonLabel: string;
    rows: { id: string; title: string; description?: string }[];
  };
  flowId?: string;
  flowCta?: string;
  bodyText?: string;
  template?: Record<string, unknown>;
}
