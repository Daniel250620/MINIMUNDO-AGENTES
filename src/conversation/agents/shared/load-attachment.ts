import type { Context } from '@google/adk';

export type LoadedAttachment =
  | { available: true; bytes: Buffer; mimeType: string }
  | { available: false; message: string };

/** Helper para tools de cualquier agente: no lanza; un archivo perdido (p. ej. tras un reinicio) se reporta como no disponible. */
export async function loadAttachment(
  ctx: Context,
  name: string,
): Promise<LoadedAttachment> {
  const unavailable = {
    available: false as const,
    message: `El archivo ${name} ya no está disponible; pide al cliente que lo reenvíe.`,
  };
  try {
    const inline = (await ctx.loadArtifact(name))?.inlineData;
    if (!inline?.data) return unavailable;
    return {
      available: true,
      bytes: Buffer.from(inline.data, 'base64'),
      mimeType: inline.mimeType ?? 'application/octet-stream',
    };
  } catch {
    return unavailable;
  }
}
