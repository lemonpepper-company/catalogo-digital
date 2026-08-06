import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/painel/Sidebar";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

let pathname = "/painel";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/painel";
});

describe("Sidebar", () => {
  it("renders the logo image when logoUrl is present", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl="https://cdn.test/logo.jpg"
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    const img = screen.getByRole("img", { name: "Ateliê Mira" });
    expect(img.getAttribute("src")).toBe("https://cdn.test/logo.jpg");
    expect(screen.queryByText("AM")).toBeNull();
  });

  it("falls back to the monogram when there is no logo", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    expect(screen.getByText("AM")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the real store name", () => {
    render(
      <Sidebar
        name="Loja Nova"
        monogram={null}
        logoUrl={null}
        catalogUrl="https://vtrine.test/loja-nova"
      />
    );
    expect(screen.getByText("Loja Nova")).toBeTruthy();
    // monogram derived from name when null
    expect(screen.getByText("LO")).toBeTruthy();
  });

  it("mostra o item de navegação Personalização", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    expect(screen.getByText("Personalização")).toBeTruthy();
  });
});

describe("Sidebar — item Pedidos (ORD-16)", () => {
  it("mostra o link Pedidos logo depois de Produtos", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );

    const pedidos = screen.getByRole("link", { name: "Pedidos" });
    expect(pedidos.getAttribute("href")).toBe("/painel/pedidos");

    const nav = screen.getByRole("navigation");
    const labels = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual([
      "Dashboard",
      "Produtos",
      "Pedidos",
      "Categorias",
      "Personalização",
      "Configurações",
      "Assinatura",
    ]);
  });

  it("marca Pedidos como ativo em /painel/pedidos", () => {
    pathname = "/painel/pedidos";
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );

    expect(
      screen.getByRole("link", { name: "Pedidos" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")
    ).toBeNull();
  });

  it("mantém Pedidos inativo no dashboard", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );

    expect(
      screen.getByRole("link", { name: "Pedidos" }).getAttribute("aria-current")
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")
    ).toBe("page");
  });
});

describe("Sidebar — link de suporte", () => {
  it("mostra um link de Suporte apontando para o WhatsApp da Vtrine", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    const link = screen.getByRole("link", { name: /suporte/i });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Preciso de suporte com minha loja na Vtrine Digital."
      )}`
    );
  });
});

describe("Sidebar — link do catálogo com domínio próprio", () => {
  it("mostra o domínio próprio quando o link já vem resolvido para ele", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://minhaloja.com.br"
      />
    );

    const link = screen.getByRole("link", { name: /minhaloja\.com\.br/ });
    expect(link.getAttribute("href")).toBe("https://minhaloja.com.br");
  });

  it("não mostra o card de catálogo quando catalogUrl é null", () => {
    render(
      <Sidebar name="Ateliê Mira" monogram="AM" logoUrl={null} catalogUrl={null} />
    );

    expect(screen.queryByText("Catálogo público em")).toBeNull();
  });
});
