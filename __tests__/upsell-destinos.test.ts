import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ARQUIVOS_DE_UPSELL = [
  "components/painel/RecursoBloqueado.tsx",
  "components/painel/UpsellHint.tsx",
  "app/painel/layout.tsx",
  "components/loja/DominioField.tsx",
  "app/painel/produtos/ProdutosClient.tsx",
];

describe("CTAs de upsell", () => {
  it.each(ARQUIVOS_DE_UPSELL)("%s não aponta para o WhatsApp", (caminho) => {
    const src = readFileSync(caminho, "utf8");
    expect(src).not.toMatch(/wa\.me/);
    expect(src).not.toMatch(/vtrineWhatsAppHref/);
  });

  it("nenhum número de telefone hardcoded sobrou", () => {
    for (const caminho of ARQUIVOS_DE_UPSELL) {
      expect(readFileSync(caminho, "utf8")).not.toMatch(/5535\d{9}/);
    }
  });
});
