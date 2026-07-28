import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Regressão para o bug: tailwind.config.ts apontava ivory/linen/sand direto para
 * var(--color-bg)/var(--color-surface)/var(--color-border) (referências opacas),
 * o que faz o Tailwind v3 DESCARTAR silenciosamente qualquer utilitário com
 * modificador de opacidade (ex.: bg-sand/70, border-sand/50) — nenhuma regra CSS
 * é emitida, sem erro de build. O fix usa o padrão rgb(var(--color-x-rgb) /
 * <alpha-value>), que é composável com opacidade.
 *
 * Este teste roda o binário real do Tailwind sobre um fixture mínimo e confere
 * que os utilitários com opacidade continuam sendo gerados — e que a cor base
 * (sem opacidade) não regride.
 */
describe("Tailwind — utilitários ivory/linen/sand com modificador de opacidade", () => {
  const dir = mkdtempSync(join(tmpdir(), "tw-alpha-"));
  const fixtureDir = join(dir, "app");
  const fixtureFile = join(fixtureDir, "fixture.tsx");
  const outFile = join(dir, "out.css");

  it("gera regras CSS para bg-sand/70, border-sand/50, bg-linen/50 e text-ivory/70", () => {
    execFileSync("node", ["-e", `require("fs").mkdirSync(${JSON.stringify(fixtureDir)}, { recursive: true })`]);
    writeFileSync(
      fixtureFile,
      'export const X = () => <div className="bg-sand/70 border-sand/50 bg-linen/50 text-ivory/70 bg-ivory bg-linen border-sand" />;\n'
    );

    execFileSync(
      "node_modules/.bin/tailwindcss",
      ["-i", "./app/globals.css", "-o", outFile, "--content", join(fixtureDir, "**/*.{ts,tsx}")],
      { cwd: process.cwd() }
    );

    const css = readFileSync(outFile, "utf8");

    // Utilitários com opacidade — o bug fazia esses sumirem por completo.
    expect(css).toContain(".bg-sand\\/70 {");
    expect(css).toContain(".border-sand\\/50 {");
    expect(css).toContain(".bg-linen\\/50 {");
    expect(css).toContain(".text-ivory\\/70 {");

    // Cada um deve compor rgb(var(--color-x-rgb) / <valor decimal>), não um valor
    // fixo — prova de que o alpha foi de fato injetado a partir do modificador.
    expect(css).toMatch(/\.bg-sand\\\/70\s*{\s*background-color:\s*rgb\(var\(--color-border-rgb\)\s*\/\s*0\.7\)/);
    expect(css).toMatch(/\.border-sand\\\/50\s*{\s*border-color:\s*rgb\(var\(--color-border-rgb\)\s*\/\s*0\.5\)/);
    expect(css).toMatch(/\.bg-linen\\\/50\s*{\s*background-color:\s*rgb\(var\(--color-surface-rgb\)\s*\/\s*0\.5\)/);
    expect(css).toMatch(/\.text-ivory\\\/70\s*{\s*color:\s*rgb\(var\(--color-bg-rgb\)\s*\/\s*0\.7\)/);

    // Cores base (sem opacidade) continuam resolvendo a partir das mesmas
    // variáveis "-rgb", sem regressão visual (alpha total = 1).
    expect(css).toMatch(/\.bg-ivory\s*{[^}]*background-color:\s*rgb\(var\(--color-bg-rgb\)/);
    expect(css).toMatch(/\.bg-linen\s*{[^}]*background-color:\s*rgb\(var\(--color-surface-rgb\)/);
    expect(css).toMatch(/\.border-sand\s*{[^}]*border-color:\s*rgb\(var\(--color-border-rgb\)/);
  }, 20000);

  it("as variáveis -rgb em app/globals.css correspondem aos hex de --color-bg/--color-surface/--color-border", () => {
    const globals = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    const hexToRgb = (hex: string) => {
      const full = hex.replace("#", "");
      return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(" ");
    };

    const bgHex = /--color-bg:\s*#([0-9A-Fa-f]{6})/.exec(globals)![1];
    const surfaceHex = /--color-surface:\s*#([0-9A-Fa-f]{6})/.exec(globals)![1];
    const borderHex = /--color-border:\s*#([0-9A-Fa-f]{6})/.exec(globals)![1];

    const bgRgb = /--color-bg-rgb:\s*([0-9]+ [0-9]+ [0-9]+)/.exec(globals)![1];
    const surfaceRgb = /--color-surface-rgb:\s*([0-9]+ [0-9]+ [0-9]+)/.exec(globals)![1];
    const borderRgb = /--color-border-rgb:\s*([0-9]+ [0-9]+ [0-9]+)/.exec(globals)![1];

    expect(bgRgb).toBe(hexToRgb(bgHex));
    expect(surfaceRgb).toBe(hexToRgb(surfaceHex));
    expect(borderRgb).toBe(hexToRgb(borderHex));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});
