import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssinaturaClient } from "@/app/painel/assinatura/AssinaturaClient";

vi.mock("@/app/actions/assinatura", () => ({
  iniciarAssinatura: vi.fn(),
  trocarPlano: vi.fn(),
  cancelarAssinatura: vi.fn(),
  salvarDocumento: vi.fn(),
}));

const BASE = {
  plan: "free" as const,
  planExpiresAt: null,
  subscriptionStatus: null,
  billingCycle: null,
  pendingPlan: null,
};

describe("AssinaturaClient", () => {
  it("sem assinatura, oferece os planos e não mostra cancelar", () => {
    render(<AssinaturaClient {...BASE} />);
    expect(screen.getByText(/R\$ 29,90/)).toBeTruthy();
    expect(screen.getByText(/R\$ 59,90/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cancelar assinatura/i })).toBeNull();
  });

  it("ativa mostra a data de renovação", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/renova em 12 de setembro/i)).toBeTruthy();
  });

  it("past_due avisa a falha e o prazo", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="past_due"
        planExpiresAt="2026-08-15T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/cobran(ç|c)a falhou/i)).toBeTruthy();
    expect(screen.getByText(/15 de agosto/i)).toBeTruthy();
  });

  it("cancelada diz até quando o acesso vale", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="canceled"
        planExpiresAt="2026-08-30T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/termina em 30 de agosto/i)).toBeTruthy();
  });

  it("downgrade agendado é anunciado", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        pendingPlan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/muda para Starter em 12 de setembro/i)).toBeTruthy();
  });

  it("no cartão avisa que haverá redirecionamento", () => {
    render(<AssinaturaClient {...BASE} />);
    expect(screen.getByText(/voc(ê|e) ser(á|a) redirecionado/i)).toBeTruthy();
  });

  it("mesmo plano com ciclo diferente fica desabilitado e não chama trocarPlano", async () => {
    const { trocarPlano } = await import("@/app/actions/assinatura");
    vi.mocked(trocarPlano).mockClear();

    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    const botaoCicloAnual = screen.getByRole("button", { name: /fale com o suporte/i });
    expect(botaoCicloAnual).toBeDisabled();

    fireEvent.click(botaoCicloAnual);
    expect(trocarPlano).not.toHaveBeenCalled();

    // upgrade real (Starter) continua habilitado e chamável.
    const botaoUpgrade = screen.getByRole("button", { name: /assinar starter mensal/i });
    expect(botaoUpgrade).not.toBeDisabled();
  });
});

describe("AssinaturaClient — modal de documento", () => {
  it("não aparece antes de tentar assinar", () => {
    render(<AssinaturaClient {...BASE} document={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abre quando a action devolve DOCUMENTO_NECESSARIO", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({ error: "DOCUMENTO_NECESSARIO" });

    render(<AssinaturaClient {...BASE} document={null} />);
    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /assinar/i })[0]);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText(/CPF ou CNPJ/i)).toBeTruthy();
  });

  it("nunca exibe DOCUMENTO_NECESSARIO como mensagem de erro", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({ error: "DOCUMENTO_NECESSARIO" });

    render(<AssinaturaClient {...BASE} document={null} />);
    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /assinar/i })[0]);

    await screen.findByRole("dialog");
    expect(screen.queryByText(/DOCUMENTO_NECESSARIO/)).toBeNull();
  });
});
