/** Minúsculas, sin acentos y sin espacios sobrantes: para comparar nombres escritos por personas o por el modelo. */
export const normalizeText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
