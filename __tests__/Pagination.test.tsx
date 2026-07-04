import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "@/components/ui/Pagination";

describe("Pagination", () => {
  it("não renderiza nada quando há 1 página ou menos", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} basePath="/painel/produtos" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza todos os números quando são poucas páginas", () => {
    render(<Pagination currentPage={2} totalPages={3} basePath="/painel/produtos" />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("marca a página atual com aria-current", () => {
    render(<Pagination currentPage={2} totalPages={3} basePath="/painel/produtos" />);
    const current = screen.getByText("2");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("1").getAttribute("aria-current")).toBeNull();
  });

  it("gera os links com o basePath e o número de página corretos", () => {
    render(<Pagination currentPage={2} totalPages={3} basePath="/painel/produtos" />);
    expect(screen.getByText("3").getAttribute("href")).toBe("/painel/produtos?page=3");
  });

  it("mostra reticências quando há muitas páginas", () => {
    render(<Pagination currentPage={1} totalPages={12} basePath="/painel/produtos" />);
    expect(screen.getByText("…")).toBeTruthy();
  });

  it("desabilita 'Anterior' na primeira página e 'Próxima' na última", () => {
    render(<Pagination currentPage={1} totalPages={3} basePath="/painel/produtos" />);
    expect(screen.getByText("‹ Anterior").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Próxima ›").getAttribute("aria-disabled")).toBeNull();
  });

  it("inclui extraParams nos links gerados, junto com page", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={3}
        basePath="/painel/produtos"
        extraParams={{ q: "vestido", categoria: "cat-1" }}
      />
    );
    expect(screen.getByText("3").getAttribute("href")).toBe(
      "/painel/produtos?page=3&q=vestido&categoria=cat-1"
    );
  });
});
