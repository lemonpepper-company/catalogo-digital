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

  it("mostra o aviso de upsell quando bloqueado", () => {
    setup(false);
    expect(
      screen.getByRole("link", { name: "Disponível no Starter — fale conosco" })
    ).toBeTruthy();
  });

  it("não mostra tooltip nem aviso de upsell quando desbloqueado", () => {
    setup(true);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Disponível no Starter — fale conosco" })
    ).toBeNull();
  });

  it("mantém a opção padrão do pareamento de fonte sempre clicável, mesmo bloqueado", () => {
    setup(false);
    expect(screen.getByRole("button", { name: /Padrão/ })).not.toBeDisabled();
  });
});
