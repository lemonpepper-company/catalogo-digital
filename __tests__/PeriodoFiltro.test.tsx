import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockReset();
});

describe("PeriodoFiltro — presets (ORD-46)", () => {
  it("mostra os quatro presets e o botão Personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "7 dias" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todo período" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Personalizado" })).toBeTruthy();
  });

  it('marca "Este mês" como ativo por padrão, sem nenhum prop de período', () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(
      screen.getByRole("button", { name: "Este mês" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Hoje" }).getAttribute("aria-pressed")
    ).toBe("false");
  });

  it('marca o preset correspondente a "periodo" como ativo', () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    expect(
      screen.getByRole("button", { name: "Hoje" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Este mês" }).getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("navega para o basePath com ?periodo=hoje ao clicar em Hoje", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });

  it("navega sem parâmetro de período ao clicar em Este mês (é o default)", () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));

    expect(replace).toHaveBeenCalledWith("/painel", { scroll: false });
  });

  it("navega com ?periodo=tudo ao clicar em Todo período", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    fireEvent.click(screen.getByRole("button", { name: "Todo período" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=tudo", {
      scroll: false,
    });
  });

  it("preserva extraParams (ex: busca) ao trocar de preset", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" extraParams={{ q: "ana" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });
});

describe("PeriodoFiltro — range customizado (ORD-46)", () => {
  it("esconde os campos De/Até até clicar em Personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.queryByLabelText("De")).toBeNull();
    expect(screen.queryByLabelText("Até")).toBeNull();
  });

  it("revela os campos De/Até ao clicar em Personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));

    expect(screen.getByLabelText("De")).toBeTruthy();
    expect(screen.getByLabelText("Até")).toBeTruthy();
  });

  it("começa com os campos abertos e preenchidos quando de/ate vêm por prop", () => {
    render(<PeriodoFiltro basePath="/painel" de="2026-07-01" ate="2026-07-10" />);

    expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-07-01");
    expect((screen.getByLabelText("Até") as HTMLInputElement).value).toBe("2026-07-10");
    expect(
      screen.getByRole("button", { name: "Personalizado" }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("desabilita Aplicar até as duas datas estarem preenchidas", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    const aplicar = screen.getByRole("button", { name: "Aplicar" });
    expect(aplicar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-07-01" } });
    expect(aplicar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-07-10" } });
    expect(aplicar).not.toBeDisabled();
  });

  it("navega com de/ate e sem periodo ao clicar em Aplicar", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-07-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?de=2026-07-01&ate=2026-07-10", {
      scroll: false,
    });
  });
});
