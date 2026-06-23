import { describe, it, expect, vi } from "vitest";
import {
  uploadToBucket,
  uploadPhotos,
  publicUrlToPath,
} from "@/lib/server/upload";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeFile(name: string, size: number, type = "image/jpeg") {
  const file = new File([new Uint8Array(Math.max(size, 1))], name, { type });
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
