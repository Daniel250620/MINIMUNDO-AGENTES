export function sniffKind(b: Buffer): 'pdf' | 'image' | null {
  const starts = (sig: number[], offset = 0) =>
    sig.every((byte, i) => b[offset + i] === byte);
  if (starts([0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (
    starts([0x89, 0x50, 0x4e, 0x47]) || // PNG
    starts([0xff, 0xd8, 0xff]) || // JPEG
    (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) // RIFF....WEBP
  )
    return 'image';
  return null;
}
