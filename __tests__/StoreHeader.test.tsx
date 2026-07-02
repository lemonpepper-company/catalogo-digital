import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import type { Store } from "@/lib/types";

const baseStore: Store = {
  name: "Ateliê Mira",
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos"],
  description: "Vitrine premium",
  accentColor: "#C9A96E",
  catalogUrl: "vtrinedigital.com.br/ateliemira",
};

function renderHeader(
  store: Store,
  props: Partial<React.ComponentProps<typeof StoreHeader>> = {}
) {
  return render(
    <StoreHeader
      store={store}
      activeProductCount={3}
      bagCount={0}
      onOpenBag={vi.fn()}
      searchOpen={false}
      searchQuery=""
      onSearchChange={vi.fn()}
      onToggleSearch={vi.fn()}
      {...props}
    />
  );
}

describe("StoreHeader", () => {
  it("renders the logo image when logoUrl is present", () => {
    renderHeader({ ...baseStore, logoUrl: "https://cdn.test/logo.jpg" });
    const img = screen.getByRole("img", { name: "Ateliê Mira" });
    expect(img.getAttribute("src")).toBe("https://cdn.test/logo.jpg");
    expect(screen.queryByText("AM")).toBeNull();
  });

  it("falls back to the monogram when there is no logo", () => {
    renderHeader(baseStore);
    expect(screen.getByText("AM")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("não exibe o campo de busca quando fechado (CAT-B01)", () => {
    renderHeader(baseStore, { searchOpen: false });
    expect(screen.queryByRole("textbox", { name: "Buscar produtos pelo nome" })).toBeNull();
  });

  it("exibe o campo de busca quando aberto (CAT-B01)", () => {
    renderHeader(baseStore, { searchOpen: true });
    expect(
      screen.getByRole("textbox", { name: "Buscar produtos pelo nome" })
    ).toBeTruthy();
  });

  it("aciona onToggleSearch ao clicar na lupa (CAT-B01/B06)", () => {
    const onToggleSearch = vi.fn();
    renderHeader(baseStore, { onToggleSearch });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(onToggleSearch).toHaveBeenCalledTimes(1);
  });

  it("propaga o texto digitado via onSearchChange (CAT-B02)", () => {
    const onSearchChange = vi.fn();
    renderHeader(baseStore, { searchOpen: true, onSearchChange });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar produtos pelo nome" }),
      { target: { value: "vestido" } }
    );
    expect(onSearchChange).toHaveBeenCalledWith("vestido");
  });
});
