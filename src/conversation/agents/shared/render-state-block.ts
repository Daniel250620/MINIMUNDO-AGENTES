/** Claves del state que se muestran al modelo, con su etiqueta; el resto (turn, outbound, etc.) es interno. */
const SHOWN: Record<string, string> = {
  customerName: 'Nombre',
  phone: 'Teléfono',
};

/** Bloque "estado actual del cliente" para la instrucción; vacío si no hay nada que mostrar. */
export function renderStateBlock(state: Record<string, unknown>): string {
  const lines = Object.entries(SHOWN)
    .filter(([key]) => state[key] != null && state[key] !== '')
    .map(([key, label]) => `- ${label}: ${String(state[key])}`);
  return lines.length
    ? `\n\nEstado actual del cliente:\n${lines.join('\n')}`
    : '';
}
