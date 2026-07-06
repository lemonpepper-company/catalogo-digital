const SIGNATURES: { type: string; bytes: (number | null)[] }[] = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  {
    type: "image/webp",
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
];

export function detectImageMimeType(bytes: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    const matches = signature.bytes.every(
      (expected, i) => expected === null || bytes[i] === expected
    );
    if (matches) return signature.type;
  }
  return null;
}
