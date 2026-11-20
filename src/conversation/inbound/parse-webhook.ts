import type { IncomingMessage } from './incoming-message';
import type { WhatsappMessage, WhatsappWebhookBody } from './whatsapp-payload';

/** Recorre todos los mensajes de todos los entry/changes, en el orden de Meta; los payloads sólo de statuses dan []. */
export function parseWebhook(body: WhatsappWebhookBody): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      for (const m of value?.messages ?? []) {
        const contact =
          value?.contacts?.find((c) => c.wa_id === m.from) ??
          value?.contacts?.[0];
        out.push(normalize(m, contact?.profile?.name ?? null));
      }
    }
  }
  return out;
}

function normalize(
  m: WhatsappMessage,
  contactName: string | null,
): IncomingMessage {
  const base = {
    from: m.from,
    wamid: m.id,
    contactName,
    rawType: m.type,
    replyToWamid: m.context?.id ?? null,
  };
  switch (m.type) {
    case 'text':
      return { ...base, type: m.type, text: m.text.body };
    case 'image':
      return {
        ...base,
        type: m.type,
        text: m.image.caption ?? null,
        mediaId: m.image.id,
      };
    case 'document':
      return {
        ...base,
        type: m.type,
        text: m.document.caption ?? null,
        mediaId: m.document.id,
        filename: m.document.filename,
      };
    case 'location': {
      const { latitude, longitude, name, address } = m.location;
      const label = [name, address].filter(Boolean).join(', ');
      return {
        ...base,
        type: m.type,
        text: `Ubicación: ${latitude}, ${longitude}${label ? ` (${label})` : ''}`,
        location: { latitude, longitude },
      };
    }
    case 'interactive': {
      const i = m.interactive;
      const selection =
        i.type === 'button_reply'
          ? i.button_reply
          : i.type === 'list_reply'
            ? i.list_reply
            : null;
      if (!selection)
        return { ...base, type: 'unsupported' as const, text: null };
      return {
        ...base,
        type: m.type,
        text: selection.title,
        selection: { id: selection.id, title: selection.title },
      };
    }
    case 'button':
      // Botón de plantilla: el payload es el id, como en un button_reply.
      return {
        ...base,
        type: 'interactive',
        text: m.button.text,
        selection: { id: m.button.payload, title: m.button.text },
      };
    default:
      return {
        ...base,
        type: 'unsupported' as const,
        text: null,
        errors: m.errors,
      };
  }
}
