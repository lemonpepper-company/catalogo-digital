import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import type { Store } from "@/lib/types";

const baseStore: Store = {
  name: "Ateliê Mira",
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos"],
  description: "Vitrine premium",
  accentColor: "#C9A96E",
  catalogUrl: "catalogo.app/ateliemira",
};

function renderHeader(store: Store) {
  return render(
    <StoreHeader
      store={store}
      activeProductCount={3}
      bagCount={0}
      onOpenBag={vi.fn()}
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
});
