import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

/**
 * `useTransition` real não fica "pending" de forma observável em teste quando o
 * `router.replace` mockado é síncrono (não há trabalho assíncrono real pro React
 * suspender) — por isso controlamos `isPending` diretamente aqui. O default
 * (`false`, `startTransition` chamando o callback na hora) reproduz o
 * comportamento real para todos os outros testes deste arquivo.
 */
let mockIsPending = false;
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useTransition: () => [mockIsPending, (callback: () => void) => callback()],
  };
});

beforeEach(() => {
  replace.mockReset();
  mockIsPending = false;
});

/** Abre o dropdown clicando no botão-gatilho (mostra o valor atual, sempre único quando fechado). */
function openDropdown(currentValueLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: currentValueLabel }));
}

describe("PeriodoFiltro — dropdown de presets (ORD-48)", () => {
  it("mostra Este mês como valor selecionado por padrão, sem nenhum prop de período", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
  });

  it("mostra o rótulo do preset correspondente a periodo como valor selecionado", () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
  });

  it("ao abrir, lista os quatro presets e a ação de período personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    openDropdown("Este mês");

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "7 dias" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todo período" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Período personalizado" })).toBeTruthy();
    // "Este mês" aparece duas vezes quando aberto: o gatilho (valor atual) e a opção da lista.
    expect(screen.getAllByText("Este mês")).toHaveLength(2);
  });

  it("selecionar um preset navega para o basePath com ?periodo=<preset>", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });

  it("selecionar Todo período navega com ?periodo=tudo", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Todo período" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=tudo", {
      scroll: false,
    });
  });

  it("selecionar Este mês (o default) navega sem parâmetro de período", () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    openDropdown("Hoje");
    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));

    expect(replace).toHaveBeenCalledWith("/painel", { scroll: false });
  });

  it("preserva extraParams (ex: busca) ao selecionar um preset", () => {
    render(
      <PeriodoFiltro basePath="/painel/pedidos" extraParams={{ q: "ana" }} />
    );

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });
});

describe("PeriodoFiltro — valor exibido para range customizado (ORD-48)", () => {
  it("mostra o range abreviado como valor selecionado quando de/ate válidos vêm por prop, mesmo ano", () => {
    render(<PeriodoFiltro basePath="/painel" de="2026-07-01" ate="2026-07-10" />);

    expect(
      screen.getByRole("button", { name: "1 jul – 10 jul 2026" })
    ).toBeTruthy();
  });

  it("inclui o ano nos dois lados quando de/ate estão em anos diferentes", () => {
    render(<PeriodoFiltro basePath="/painel" de="2025-12-20" ate="2026-01-05" />);

    expect(
      screen.getByRole("button", { name: "20 dez 2025 – 5 jan 2026" })
    ).toBeTruthy();
  });
});

describe("PeriodoFiltro — modal de período personalizado (ORD-48)", () => {
  function openCustomModal(currentValueLabel: string): HTMLElement {
    openDropdown(currentValueLabel);
    fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
    return screen.getByRole("dialog", { name: "Período personalizado" });
  }

  it("abre com os campos De/Até vazios quando não há range customizado ativo", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    const dialog = openCustomModal("Este mês");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe("");
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe("");
  });

  it("abre com os campos De/Até preenchidos quando já há um range customizado ativo", () => {
    render(<PeriodoFiltro basePath="/painel" de="2026-07-01" ate="2026-07-10" />);

    const dialog = openCustomModal("1 jul – 10 jul 2026");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe(
      "2026-07-01"
    );
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe(
      "2026-07-10"
    );
  });

  it("desabilita Aplicar até as duas datas estarem preenchidas", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    const dialog = openCustomModal("Este mês");
    const aplicar = within(dialog).getByRole("button", { name: "Aplicar" });
    expect(aplicar).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("De"), {
      target: { value: "2026-07-01" },
    });
    expect(aplicar).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Até"), {
      target: { value: "2026-07-10" },
    });
    expect(aplicar).not.toBeDisabled();
  });

  it("aplicar navega com de/ate e fecha a modal", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    const dialog = openCustomModal("Este mês");
    fireEvent.change(within(dialog).getByLabelText("De"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("Até"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(replace).toHaveBeenCalledWith(
      "/painel/pedidos?de=2026-07-01&ate=2026-07-10",
      { scroll: false }
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("preserva extraParams ao aplicar o range customizado", () => {
    render(
      <PeriodoFiltro basePath="/painel/pedidos" extraParams={{ q: "ana" }} />
    );

    const dialog = openCustomModal("Este mês");
    fireEvent.change(within(dialog).getByLabelText("De"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("Até"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(replace).toHaveBeenCalledWith(
      "/painel/pedidos?q=ana&de=2026-07-01&ate=2026-07-10",
      { scroll: false }
    );
  });

  it("fechar sem aplicar não navega e fecha a modal", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    const dialog = openCustomModal("Este mês");
    fireEvent.click(within(dialog).getByLabelText("Fechar"));

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PeriodoFiltro — feedback de carregamento (ORD-49)", () => {
  it("não mostra o spinner quando não há navegação pendente", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.queryByTestId("periodo-filtro-loading")).toBeNull();
  });

  it("mostra um spinner enquanto a navegação está pendente", () => {
    mockIsPending = true;
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.getByTestId("periodo-filtro-loading")).toBeTruthy();
  });

  it("desabilita a interação com o dropdown enquanto a navegação está pendente", () => {
    mockIsPending = true;
    render(<PeriodoFiltro basePath="/painel" />);

    expect(
      screen.getByRole("button", { name: "Este mês" }).closest('[class*="pointer-events-none"]')
    ).toBeTruthy();
  });
});
