import { describe, it, expect } from "vitest";
import { isOwnHost, stripWwwPrefix } from "@/lib/domain-routing";

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

describe("stripWwwPrefix", () => {
  it("remove o prefixo www. líder", () => {
    expect(stripWwwPrefix("www.boutiquedaana.com.br")).toBe("boutiquedaana.com.br");
  });

  it("não mexe num domínio sem www", () => {
    expect(stripWwwPrefix("boutiquedaana.com.br")).toBe("boutiquedaana.com.br");
  });

  it("remove só um www. líder, não qualquer ocorrência no meio do host", () => {
    expect(stripWwwPrefix("www.www.boutiquedaana.com.br")).toBe("www.boutiquedaana.com.br");
  });

  it("não remove www quando não é seguido de ponto (não é o prefixo canônico)", () => {
    expect(stripWwwPrefix("wwwstore.com")).toBe("wwwstore.com");
  });

  it("é case-insensitive no prefixo (defensivo — chamadores já normalizam para minúsculo)", () => {
    expect(stripWwwPrefix("WWW.boutiquedaana.com.br")).toBe("boutiquedaana.com.br");
  });
});
