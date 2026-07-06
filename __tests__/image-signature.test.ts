import { describe, it, expect } from "vitest";
import { detectImageMimeType } from "../lib/server/image-signature";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("detectImageMimeType", () => {
  it("reconhece JPEG", () => {
    expect(detectImageMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
  });

  it("reconhece PNG", () => {
    expect(
      detectImageMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    ).toBe("image/png");
  });

  it("reconhece GIF", () => {
    expect(detectImageMimeType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe(
      "image/gif"
    );
  });

  it("reconhece WEBP", () => {
    expect(
      detectImageMimeType(
        bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50)
      )
    ).toBe("image/webp");
  });

  it("rejeita conteúdo que não bate com nenhuma assinatura conhecida (ex.: SVG/HTML)", () => {
    const svg = new TextEncoder().encode("<svg><script>alert(1)</script></svg>");
    expect(detectImageMimeType(svg)).toBeNull();
  });

  it("rejeita buffer vazio", () => {
    expect(detectImageMimeType(bytes())).toBeNull();
  });
});
