const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

function withJpegExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  return `${base}.jpg`;
}

export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; quality?: number }
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const maxDimension = opts?.maxDimension ?? MAX_DIMENSION;
  const quality = opts?.quality ?? JPEG_QUALITY;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    return new File([blob], withJpegExtension(file.name), {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}
