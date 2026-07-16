import type { SupabaseClient } from "@supabase/supabase-js";
import { detectImageMimeType } from "./image-signature";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function publicUrlToPath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

// Apaga um objeto do bucket a partir da sua URL pública. Best-effort:
// nunca lança — se a URL não mapear para um path ou o arquivo já não
// existir, apenas ignora, para não derrubar o save que já teve sucesso.
export async function deleteFromBucket(
  supabase: SupabaseClient,
  url: string
): Promise<void> {
  const path = publicUrlToPath(url);
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // ignora falhas silenciosamente
  }
}

export async function uploadToBucket(
  supabase: SupabaseClient,
  path: string,
  file: File
): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Arquivo muito grande. Tamanho máximo: 5MB.");
  }

  // Confia no conteúdo real do arquivo (magic bytes), não no file.type
  // declarado pelo cliente — evita upload de SVG/HTML disfarçado de imagem.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageMimeType(bytes);
  if (!contentType) {
    throw new Error("Tipo de arquivo não permitido. Envie JPEG, PNG, WEBP ou GIF.");
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType });
  if (error) throw new Error("Falha no upload.");
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadPhotos(
  supabase: SupabaseClient,
  storeId: string,
  files: File[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
    urls.push(await uploadToBucket(supabase, path, file));
  }
  return urls;
}
