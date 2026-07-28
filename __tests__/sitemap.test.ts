import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("inclui as 5 novas páginas de SEO", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://vtrinedigital.com.br/vitrine-digital");
    expect(urls).toContain("https://vtrinedigital.com.br/catalogo-digital-gratis");
    expect(urls).toContain("https://vtrinedigital.com.br/vender-pelo-whatsapp");
    expect(urls).toContain("https://vtrinedigital.com.br/vitrine-online-sem-carrinho");
    expect(urls).toContain("https://vtrinedigital.com.br/alternativa-linktree-para-vender");
  });

  it("mantém a home e as páginas legais", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://vtrinedigital.com.br/");
    expect(urls).toContain("https://vtrinedigital.com.br/politica-de-privacidade");
    expect(urls).toContain("https://vtrinedigital.com.br/termos-de-uso");
  });

  it("tem 8 URLs no total", () => {
    expect(sitemap()).toHaveLength(8);
  });
});
