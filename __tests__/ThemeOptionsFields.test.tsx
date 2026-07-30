import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeOptionsFields } from "@/components/painel/ThemeOptionsFields";

function setup(unlocked: boolean) {
  return render(
    <ThemeOptionsFields
      fontPairing="padrao"
      onFontPairingChange={vi.fn()}
      backgroundPalette="padrao"
      onBackgroundPaletteChange={vi.fn()}
      cornerStyle="padrao"
      onCornerStyleChange={vi.fn()}
      unlocked={unlocked}
    />
  );
}

describe("ThemeOptionsFields — bloqueio por plano", () => {
  it("mostra tooltip 'Disponível no Starter' nas opções bloqueadas", () => {
    setup(false);
    const tooltips = screen.getAllByRole("tooltip");
    expect(tooltips.length).toBeGreaterThan(0);
    tooltips.forEach((t) => expect(t).toHaveTextContent("Disponível no Starter"));
  });

  it("não mostra tooltip quando desbloqueado", () => {
    setup(true);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("mantém a opção padrão do pareamento de fonte sempre clicável, mesmo bloqueado", () => {
    setup(false);
    expect(screen.getByRole("button", { name: /Padrão/ })).not.toBeDisabled();
  });
});
