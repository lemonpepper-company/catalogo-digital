import { describe, it, expect } from "vitest";
import {
  FONT_PAIRINGS,
  BACKGROUND_PALETTES,
  CORNER_STYLES,
  DEFAULT_FONT_PAIRING_KEY,
  DEFAULT_BACKGROUND_PALETTE_KEY,
  DEFAULT_CORNER_STYLE_KEY,
  getFontPairing,
  getBackgroundPalette,
  getCornerStyle,
  resolveTheme,
} from "@/lib/theme-options";

describe("opções de tema", () => {
  it("o pareamento padrão usa exatamente a fonte atual do produto (Sora/DM Sans)", () => {
    const padrao = getFontPairing(DEFAULT_FONT_PAIRING_KEY);
    expect(padrao.fontDisplayVar).toBe("--font-sora");
    expect(padrao.fontBodyVar).toBe("--font-dm-sans");
  });

  it("a paleta de fundo padrão usa exatamente as cores atuais (Ivory/Linen/Sand)", () => {
    const padrao = getBackgroundPalette(DEFAULT_BACKGROUND_PALETTE_KEY);
    expect(padrao).toMatchObject({ background: "#F9F9F7", surface: "#F0EDE8", border: "#E2DFDA" });
  });

  it("o formato de cantos padrão usa exatamente o raio atual (16px/8px)", () => {
    const padrao = getCornerStyle(DEFAULT_CORNER_STYLE_KEY);
    expect(padrao).toMatchObject({ cardRadius: "16px", btnRadius: "8px" });
  });

  it("tem 5 pareamentos de fonte, 4 paletas de fundo e 3 formatos de cantos", () => {
    expect(FONT_PAIRINGS).toHaveLength(5);
    expect(BACKGROUND_PALETTES).toHaveLength(4);
    expect(CORNER_STYLES).toHaveLength(3);
  });

  it("getters caem para o padrão quando a chave é desconhecida", () => {
    expect(getFontPairing("chave-inexistente").key).toBe(DEFAULT_FONT_PAIRING_KEY);
    expect(getBackgroundPalette("chave-inexistente").key).toBe(DEFAULT_BACKGROUND_PALETTE_KEY);
    expect(getCornerStyle("chave-inexistente").key).toBe(DEFAULT_CORNER_STYLE_KEY);
  });
});

describe("resolveTheme", () => {
  const noFlags = { themeOptions: false };
  const themeFlag = { themeOptions: true };

  it("sem themeOptions, ignora as 3 escolhas e usa sempre o padrão de cada uma", () => {
    const resolved = resolveTheme("editorial", "areia", "arredondado", null, noFlags);
    expect(resolved.fontDisplayVar).toBe("--font-sora");
    expect(resolved.backgroundColor).toBe("#F9F9F7");
    expect(resolved.cardRadius).toBe("16px");
  });

  it("com themeOptions, aplica as 3 escolhas de forma independente", () => {
    const resolved = resolveTheme("editorial", "areia", "arredondado", null, themeFlag);
    expect(resolved.fontDisplayVar).toBe("--font-fraunces");
    expect(resolved.backgroundColor).toBe("#F5EFE6");
    expect(resolved.cardRadius).toBe("24px");
  });

  it("consegue misturar uma fonte com um fundo e cantos de 'presets' diferentes", () => {
    const resolved = resolveTheme("classico", "cinza", "reto", null, themeFlag);
    expect(resolved.fontDisplayVar).toBe("--font-playfair");
    expect(resolved.backgroundColor).toBe("#EEEEEC");
    expect(resolved.cardRadius).toBe("4px");
  });

  it("preserva secondaryColor mesmo sem themeOptions (todos os planos)", () => {
    const theme = resolveTheme("editorial", "areia", "reto", "#8B0000", {
      themeOptions: false,
    });
    expect(theme.secondaryColor).toBe("#8B0000");
  });

  it("secondaryColor nula continua nula", () => {
    const theme = resolveTheme("padrao", "padrao", "padrao", null, {
      themeOptions: true,
    });
    expect(theme.secondaryColor).toBeNull();
  });
});
