/**
 * Contexto de mensaje citado: `handleMessage` lo antepone al texto del cliente y la encuesta lo quita del comentario.
 * Viven juntos para que el formato y su limpieza no se separen.
 */
const REPLY_CONTEXT = /^\[En respuesta a: "[\s\S]*?"\](?:\n|$)/;

export const withReplyContext = <T extends string | null | undefined>(
  quoted: string | null | undefined,
  text: T,
): T | string =>
  quoted ? `[En respuesta a: "${quoted}"]${text ? `\n${text}` : ''}` : text;

export const stripReplyContext = (text: string) =>
  text.replace(REPLY_CONTEXT, '');
