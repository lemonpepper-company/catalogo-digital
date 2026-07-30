import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockReset();
});

const startTransition = (callback: () => void) => callback();

function renderFiltro(props: Partial<React.ComponentProps<typeof PeriodoFiltro>> = {}) {
  return render(
    <PeriodoFiltro
      basePath="/painel"
      isPending={false}
      startTransition={startTransition}
      {...props}
    />
  );
}

/** Abre o dropdown clicando no botão-gatilho (mostra o valor atual, sempre único quando fechado). */
function openDropdown(currentValueLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: currentValueLabel }));
}

describe("PeriodoFiltro — dropdown de presets (ORD-48)", () => {
  it("mostra Este mês como valor selecionado por padrão, sem nenhum prop de período", () => {
    renderFiltro();

    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
  });

  it("mostra o rótulo do preset correspondente a periodo como valor selecionado", () => {
    renderFiltro({ periodo: "hoje" });

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
  });

  it("ao abrir, lista os quatro presets e a ação de período personalizado", () => {
    renderFiltro();

    openDropdown("Este mês");

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "7 dias" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todo período" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Período personalizado" })).toBeTruthy();
    // "Este mês" aparece duas vezes quando aberto: o gatilho (valor atual) e a opção da lista.
    expect(screen.getAllByText("Este mês")).toHaveLength(2);
  });

  it("selecionar um preset navega para o basePath com ?periodo=<preset>", () => {
    renderFiltro();

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });

  it("selecionar Todo período navega com ?periodo=tudo", () => {
    renderFiltro({ basePath: "/painel/pedidos" });

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Todo período" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=tudo", {
      scroll: false,
    });
  });

  it("selecionar Este mês (o default) navega sem parâmetro de período", () => {
    renderFiltro({ periodo: "hoje" });

    openDropdown("Hoje");
    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));

    expect(replace).toHaveBeenCalledWith("/painel", { scroll: false });
  });

  it("preserva extraParams (ex: busca) ao selecionar um preset", () => {
    renderFiltro({ basePath: "/painel/pedidos", extraParams: { q: "ana" } });

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });
});

describe("PeriodoFiltro — valor exibido para range customizado (ORD-48)", () => {
  it("mostra o range abreviado como valor selecionado quando de/ate válidos vêm por prop, mesmo ano", () => {
    renderFiltro({ de: "2026-07-01", ate: "2026-07-10" });

    expect(screen.getByRole("button", { name: "1 jul – 10 jul 2026" })).toBeTruthy();
  });

  it("inclui o ano nos dois lados quando de/ate estão em anos diferentes", () => {
    renderFiltro({ de: "2025-12-20", ate: "2026-01-05" });

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
    renderFiltro();

    const dialog = openCustomModal("Este mês");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe("");
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe("");
  });

  it("abre com os campos De/Até preenchidos quando já há um range customizado ativo", () => {
    renderFiltro({ de: "2026-07-01", ate: "2026-07-10" });

    const dialog = openCustomModal("1 jul – 10 jul 2026");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe(
      "2026-07-01"
    );
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe(
      "2026-07-10"
    );
  });

  it("desabilita Aplicar até as duas datas estarem preenchidas", () => {
    renderFiltro();

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
    renderFiltro({ basePath: "/painel/pedidos" });

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
    renderFiltro({ basePath: "/painel/pedidos", extraParams: { q: "ana" } });

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
    renderFiltro();

    const dialog = openCustomModal("Este mês");
    fireEvent.click(within(dialog).getByLabelText("Fechar"));

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PeriodoFiltro — feedback de carregamento, controlado pelo pai (ORD-50)", () => {
  it("não mostra o spinner quando isPending é false", () => {
    renderFiltro({ isPending: false });

    expect(screen.queryByTestId("periodo-filtro-loading")).toBeNull();
  });

  it("mostra um spinner quando isPending é true", () => {
    renderFiltro({ isPending: true });

    expect(screen.getByTestId("periodo-filtro-loading")).toBeTruthy();
  });

  it("desabilita a interação com o dropdown quando isPending é true", () => {
    renderFiltro({ isPending: true });

    expect(
      screen.getByRole("button", { name: "Este mês" }).closest('[class*="pointer-events-none"]')
    ).toBeTruthy();
  });

  it("chama o startTransition recebido por prop ao navegar", () => {
    const customStartTransition = vi.fn((callback: () => void) => callback());
    renderFiltro({ startTransition: customStartTransition });

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(customStartTransition).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });
});
