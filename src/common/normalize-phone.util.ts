/**
 * Teléfono a E.164 al estilo WhatsApp México: +521 + 10 dígitos.
 * Acepta 10 dígitos, o 52/521 (con o sin "+") seguido de 10 dígitos.
 * Cualquier otro formato (otro país) solo se limpia y se antepone "+".
 */
export const normalizePhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+521${digits}`;
  if (/^521?\d{10}$/.test(digits)) return `+521${digits.slice(-10)}`;
  return `+${digits}`;
};
