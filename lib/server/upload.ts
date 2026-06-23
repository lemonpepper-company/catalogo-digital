import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "product-images";

export function publicUrlToPath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export async function uploadToBucket(
  supabase: SupabaseClient,
  path: string,
  file: File
): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });
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
