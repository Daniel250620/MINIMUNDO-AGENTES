import type { OutboundMessage } from './outbound-message';

const MAX_BUTTONS = 3;
const MAX_BUTTON_TITLE = 20;
const MAX_INTERACTIVE_BODY = 1024;
const MAX_TEXT_BODY = 4096;
const MAX_ROWS = 10;
const MAX_ROW_TITLE = 24;
const MAX_ROW_DESCRIPTION = 72;
const MAX_LIST_LABEL = 20;

/** Límites de WhatsApp en un solo lugar; lanza con el límite incumplido para que nada inválido llegue a Meta. */
export function validateOutbound(msg: OutboundMessage): void {
  const fail = (why: string): never => {
    throw new Error(`Mensaje de salida inválido: ${why}`);
  };
  const source = (doc: { url?: string; mediaId?: string }) => {
    if (!doc.url === !doc.mediaId)
      fail('un documento lleva url o mediaId, exactamente uno');
  };
  switch (msg.kind) {
    case 'text':
      if (msg.text.length > MAX_TEXT_BODY)
        fail(`el texto excede ${MAX_TEXT_BODY} caracteres`);
      break;
    case 'document':
      source(msg);
      break;
    case 'buttons':
      if (msg.document) source(msg.document);
      if (msg.text.length > MAX_INTERACTIVE_BODY)
        fail(`el cuerpo excede ${MAX_INTERACTIVE_BODY} caracteres`);
      if (msg.buttons.length > MAX_BUTTONS)
        fail(`máximo ${MAX_BUTTONS} botones`);
      if (msg.buttons.some((b) => b.title.length > MAX_BUTTON_TITLE))
        fail(`el título de un botón excede ${MAX_BUTTON_TITLE} caracteres`);
      break;
    case 'list':
      if (msg.text.length > MAX_INTERACTIVE_BODY)
        fail(`el cuerpo excede ${MAX_INTERACTIVE_BODY} caracteres`);
      if (msg.rows.length > MAX_ROWS) fail(`máximo ${MAX_ROWS} filas`);
      if (msg.buttonLabel.length > MAX_LIST_LABEL)
        fail(`la etiqueta de la lista excede ${MAX_LIST_LABEL} caracteres`);
      if (msg.rows.some((r) => r.title.length > MAX_ROW_TITLE))
        fail(`el título de una fila excede ${MAX_ROW_TITLE} caracteres`);
      if (
        msg.rows.some((r) => (r.description?.length ?? 0) > MAX_ROW_DESCRIPTION)
      )
        fail(
          `la descripción de una fila excede ${MAX_ROW_DESCRIPTION} caracteres`,
        );
      break;
  }
}
