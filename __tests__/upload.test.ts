// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  uploadToBucket,
  uploadPhotos,
  publicUrlToPath,
} from "@/lib/server/upload";
import type { SupabaseClient } from "@supabase/supabase-js";

const JPEG_MAGIC_BYTES = [0xff, 0xd8, 0xff, 0xe0];

function makeFile(
  name: string,
  size: number,
  type = "image/jpeg",
  bytes: number[] = JPEG_MAGIC_BYTES
) {
  const content = new Uint8Array(Math.max(size, bytes.length));
  content.set(bytes);
  const file = new File([content], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function makeSupabaseMock(uploadImpl: (path: string) => { error: unknown }) {
  const upload = vi.fn((path: string) => Promise.resolve(uploadImpl(path)));
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://example.com/product-images/${path}` },
  }));
  const from = vi.fn(() => ({ upload, getPublicUrl }));
  return {
    storage: { from },
  } as unknown as SupabaseClient;
}

describe("uploadToBucket", () => {
  it("returns the public URL on success", async () => {
    const supabase = makeSupabaseMock(() => ({ error: null }));
    const url = await uploadToBucket(supabase, "store1/foo.jpg", makeFile("foo.jpg", 100));
    expect(url).toBe("https://example.com/product-images/store1/foo.jpg");
  });

  it("throws when upload returns an error", async () => {
    const supabase = makeSupabaseMock(() => ({ error: new Error("boom") }));
    await expect(
      uploadToBucket(supabase, "store1/foo.jpg", makeFile("foo.jpg", 100))
    ).rejects.toThrow();
  });

  it("rejeita arquivo maior que 5MB", async () => {
    const supabase = makeSupabaseMock(() => ({ error: null }));
    const bigFile = makeFile("foo.jpg", 6 * 1024 * 1024);
    await expect(uploadToBucket(supabase, "store1/foo.jpg", bigFile)).rejects.toThrow(
      /muito grande/
    );
  });

  it("rejeita conteúdo cujo tipo real não é uma imagem suportada, mesmo com file.type mentindo", async () => {
    const supabase = makeSupabaseMock(() => ({ error: null }));
    const fakeImage = makeFile("foo.jpg", 100, "image/jpeg", [
      ...new TextEncoder().encode("<svg onload=alert(1)>"),
    ]);
    await expect(uploadToBucket(supabase, "store1/foo.jpg", fakeImage)).rejects.toThrow(
      /não permitido/
    );
  });

  it("usa o content-type detectado pelos magic bytes, não o file.type do cliente", async () => {
    const upload = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      storage: {
        from: vi.fn(() => ({
          upload,
          getPublicUrl: () => ({ data: { publicUrl: "https://example.com/x" } }),
        })),
      },
    } as unknown as SupabaseClient;

    // file.type diz PNG, mas os bytes reais são de um JPEG
    const file = makeFile("foo.png", 100, "image/png", JPEG_MAGIC_BYTES);
    await uploadToBucket(supabase, "store1/foo.png", file);

    expect(upload).toHaveBeenCalledWith(
      "store1/foo.png",
      file,
      expect.objectContaining({ contentType: "image/jpeg" })
    );
  });
});

describe("uploadPhotos", () => {
  it("ignores empty files and returns URLs in order", async () => {
    const supabase = makeSupabaseMock(() => ({ error: null }));
    const files = [makeFile("a.jpg", 100), makeFile("empty.jpg", 0), makeFile("b.jpg", 200)];
    const urls = await uploadPhotos(supabase, "store1", files);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("store1/");
    expect(urls[1]).toContain("store1/");
  });

  it("throws if any upload fails", async () => {
    const supabase = makeSupabaseMock(() => ({ error: new Error("fail") }));
    await expect(
      uploadPhotos(supabase, "store1", [makeFile("a.jpg", 100)])
    ).rejects.toThrow();
  });
});

describe("publicUrlToPath", () => {
  it("extracts the path after /product-images/", () => {
    expect(
      publicUrlToPath("https://example.com/storage/v1/object/public/product-images/store1/foo.jpg")
    ).toBe("store1/foo.jpg");
  });

  it("returns null when there is no match", () => {
    expect(publicUrlToPath("https://example.com/other-bucket/foo.jpg")).toBeNull();
  });
});
