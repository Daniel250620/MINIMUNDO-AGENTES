import type { BaseArtifactService } from '@google/adk';
import type { Content, Part } from '@google/genai';
import type { BatchItem } from '../batcher/message-batcher';
import type { Attachment } from '../inbound/incoming-message';
import { APP_NAME } from '../entities/adk-session.entity';

/**
 * Un solo Content por lote: texto (con la nota de cada adjunto, en orden de llegada) y después un
 * inlineData por adjunto, para que el modelo vea la imagen y conozca su nombre sin pedirla con una tool.
 */
export function buildTurn(items: BatchItem[]): {
  content: Content;
  attachments: Attachment[];
} {
  const lines: string[] = [];
  const attachments: Attachment[] = [];
  for (const { msg, attachment } of items) {
    if (msg.text) lines.push(msg.text);
    if (attachment) {
      lines.push(
        `[Archivo adjunto: ${attachment.name} (${attachment.mimeType})]`,
      );
      attachments.push(attachment);
    }
  }
  const parts: Part[] = [
    { text: lines.join('\n') },
    ...attachments.map((a) => ({
      inlineData: { data: a.data.toString('base64'), mimeType: a.mimeType },
    })),
  ];
  return { content: { role: 'user', parts }, attachments };
}

/** Los guarda en la sesión del router: el sub-agente los alcanza vía ForwardingArtifactService de AgentTool. */
export async function saveAttachments(
  artifactService: BaseArtifactService,
  userId: string,
  sessionId: string,
  attachments: Attachment[],
) {
  for (const a of attachments) {
    await artifactService.saveArtifact({
      appName: APP_NAME,
      userId,
      sessionId,
      filename: a.name,
      artifact: {
        inlineData: { data: a.data.toString('base64'), mimeType: a.mimeType },
      },
    });
  }
}
