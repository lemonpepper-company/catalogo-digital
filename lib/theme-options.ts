export interface FontPairing {
  key: string;
  label: string;
  fontDisplayVar: string;
  fontBodyVar: string;
  titleTransform: "none" | "uppercase";
  titleLetterSpacing: string;
}

export interface BackgroundPalette {
  key: string;
  label: string;
  background: string;
  surface: string;
  border: string;
}

export interface CornerStyle {
  key: string;
  label: string;
  cardRadius: string;
  btnRadius: string;
}

export const DEFAULT_FONT_PAIRING_KEY = "padrao";
export const DEFAULT_BACKGROUND_PALETTE_KEY = "padrao";
export const DEFAULT_CORNER_STYLE_KEY = "padrao";

export const FONT_PAIRINGS: FontPairing[] = [
  { key: "padrao", label: "Padrão", fontDisplayVar: "--font-sora", fontBodyVar: "--font-dm-sans", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "editorial", label: "Editorial", fontDisplayVar: "--font-fraunces", fontBodyVar: "--font-inter", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "classico", label: "Clássico", fontDisplayVar: "--font-playfair", fontBodyVar: "--font-lora", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "moderno", label: "Moderno", fontDisplayVar: "--font-space-grotesk", fontBodyVar: "--font-inter", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "minimal", label: "Minimal", fontDisplayVar: "--font-inter", fontBodyVar: "--font-inter", titleTransform: "uppercase", titleLetterSpacing: "0.06em" },
];

export const BACKGROUND_PALETTES: BackgroundPalette[] = [
  { key: "padrao", label: "Ivory (padrão)", background: "#F9F9F7", surface: "#F0EDE8", border: "#E2DFDA" },
  { key: "branco", label: "Branco puro", background: "#FFFFFF", surface: "#F7F7F5", border: "#ECECEA" },
  { key: "areia", label: "Areia quente", background: "#F5EFE6", surface: "#FFFDF9", border: "#E6DCC9" },
  { key: "cinza", label: "Cinza claro", background: "#EEEEEC", surface: "#F7F7F5", border: "#D8D8D4" },
];

export const CORNER_STYLES: CornerStyle[] = [
  { key: "padrao", label: "Atual", cardRadius: "16px", btnRadius: "8px" },
  { key: "reto", label: "Reto", cardRadius: "4px", btnRadius: "4px" },
  { key: "arredondado", label: "Arredondado", cardRadius: "24px", btnRadius: "999px" },
];

export function getFontPairing(key: string): FontPairing {
  return FONT_PAIRINGS.find((p) => p.key === key) ?? FONT_PAIRINGS[0];
}

export function getBackgroundPalette(key: string): BackgroundPalette {
  return BACKGROUND_PALETTES.find((p) => p.key === key) ?? BACKGROUND_PALETTES[0];
}

export function getCornerStyle(key: string): CornerStyle {
  return CORNER_STYLES.find((p) => p.key === key) ?? CORNER_STYLES[0];
}

export interface ThemeLimits {
  themeOptions: boolean;
}

export interface ResolvedTheme {
  fontDisplayVar: string;
  fontBodyVar: string;
  titleTransform: "none" | "uppercase";
  titleLetterSpacing: string;
  backgroundColor: string;
  surfaceColor: string;
  borderColor: string;
  cardRadius: string;
  btnRadius: string;
  secondaryColor: string | null;
}

export function resolveTheme(
  fontPairingKey: string,
  backgroundPaletteKey: string,
  cornerStyleKey: string,
  secondaryColor: string | null,
  limits: ThemeLimits
): ResolvedTheme {
  const font = limits.themeOptions ? getFontPairing(fontPairingKey) : getFontPairing(DEFAULT_FONT_PAIRING_KEY);
  const background = limits.themeOptions
    ? getBackgroundPalette(backgroundPaletteKey)
    : getBackgroundPalette(DEFAULT_BACKGROUND_PALETTE_KEY);
  const corner = limits.themeOptions ? getCornerStyle(cornerStyleKey) : getCornerStyle(DEFAULT_CORNER_STYLE_KEY);

  return {
    fontDisplayVar: font.fontDisplayVar,
    fontBodyVar: font.fontBodyVar,
    titleTransform: font.titleTransform,
    titleLetterSpacing: font.titleLetterSpacing,
    backgroundColor: background.background,
    surfaceColor: background.surface,
    borderColor: background.border,
    cardRadius: corner.cardRadius,
    btnRadius: corner.btnRadius,
    secondaryColor,
  };
}
