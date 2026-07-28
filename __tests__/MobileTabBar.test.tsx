import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileTabBar } from "@/components/painel/MobileTabBar";

let pathname = "/painel";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/painel";
});

describe("MobileTabBar — item Pedidos (ORD-16)", () => {
  it("mostra as 6 abas com Pedidos logo depois de Produtos", () => {
    render(<MobileTabBar />);

    const nav = screen.getByRole("navigation", { name: "Navegação do painel" });
    const labels = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual([
      "Dashboard",
      "Produtos",
      "Pedidos",
      "Categorias",
      "Estilo",
      "Config.",
    ]);
  });

  it("aponta a aba Pedidos para /painel/pedidos", () => {
    render(<MobileTabBar />);

    expect(
      screen.getByRole("link", { name: "Pedidos" }).getAttribute("href")
    ).toBe("/painel/pedidos");
  });

  it('abrevia "Personalização" para "Estilo" para caber em 375 px', () => {
    render(<MobileTabBar />);

    expect(screen.getByText("Estilo")).toBeTruthy();
    expect(screen.queryByText("Personalização")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Estilo" }).getAttribute("href")
    ).toBe("/painel/personalizacao");
  });

  it("marca Pedidos como ativo em /painel/pedidos", () => {
    pathname = "/painel/pedidos";
    render(<MobileTabBar />);

    expect(
      screen.getByRole("link", { name: "Pedidos" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")
    ).toBeNull();
  });

  it("mantém Pedidos inativo no dashboard", () => {
    render(<MobileTabBar />);

    expect(
      screen.getByRole("link", { name: "Pedidos" }).getAttribute("aria-current")
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")
    ).toBe("page");
  });
});
