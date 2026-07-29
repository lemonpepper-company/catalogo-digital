import { describe, it, expect } from "vitest";
import { isOwnHost } from "@/lib/domain-routing";

describe("isOwnHost", () => {
  const siteUrl = "https://catalogo.digital";

  it("reconhece o domínio principal da aplicação", () => {
    expect(isOwnHost("catalogo.digital", siteUrl)).toBe(true);
  });

  it("reconhece localhost (dev)", () => {
    expect(isOwnHost("localhost", siteUrl)).toBe(true);
  });

  it("reconhece qualquer preview da Vercel (*.vercel.app)", () => {
    expect(isOwnHost("catalogo-digital-git-main-time.vercel.app", siteUrl)).toBe(true);
  });

  it("um domínio de loja não bate com nenhum dos anteriores", () => {
    expect(isOwnHost("boutiquedaana.com.br", siteUrl)).toBe(false);
  });

  it("sem NEXT_PUBLIC_SITE_URL configurado, trata tudo como próprio (nunca tenta rotear por domínio)", () => {
    expect(isOwnHost("qualquer-coisa.com", undefined)).toBe(true);
  });
});
