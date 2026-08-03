import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

  /**
   * Primeira assinatura (Free → pago): iniciarAssinatura grava pending_plan
   * na hora, mas plan_expires_at só existe depois do webhook confirmar o
   * primeiro pagamento — sem isso a mensagem mostrava "Muda para Starter em ."
   * com data vazia.
   */
  it("primeira assinatura sem confirmação ainda não mostra data vazia", () => {
    render(<AssinaturaClient {...BASE} pendingPlan="starter" planExpiresAt={null} />);
    expect(
      screen.getByText(/assinatura em processamento.*muda para starter assim que o pagamento confirmar/i)
    ).toBeTruthy();
    expect(screen.queryByText(/muda para starter em \./i)).toBeNull();
  });

  it("no cartão avisa que haverá redirecionamento", () => {
    render(<AssinaturaClient {...BASE} />);
    expect(screen.getByText(/voc(ê|e) ser(á|a) redirecionado/i)).toBeTruthy();
  });

  /**
   * Sem meio de pagamento escolhido, os botões de plano ficam desabilitados
   * — o lojista precisa escolher explicitamente antes de disparar uma
   * assinatura, em vez de cair num padrão (Pix) que ele pode nem notar.
   */
  it("botões de plano ficam desabilitados até escolher um meio de pagamento", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockClear();

    render(<AssinaturaClient {...BASE} />);

    const botaoStarter = screen.getByRole("button", { name: /assinar starter mensal/i });
    expect(botaoStarter).toBeDisabled();
    expect(screen.getByText(/escolha um meio de pagamento acima/i)).toBeTruthy();

    fireEvent.click(botaoStarter);
    expect(iniciarAssinatura).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));
    expect(botaoStarter).not.toBeDisabled();
    expect(screen.queryByText(/escolha um meio de pagamento acima/i)).toBeNull();

    await act(async () => {
      fireEvent.click(botaoStarter);
    });
    expect(iniciarAssinatura).toHaveBeenCalledWith("starter", "monthly", "CREDIT_CARD");
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

    // Botões de plano só habilitam depois de escolher um meio de pagamento.
    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));

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

/**
 * Diferente do cartão (que redireciona pro checkout hospedado), o Pix cria a
 * cobrança sem sair do site — sem mostrar o link em algum lugar, o lojista
 * não tem como pagar.
 */
describe("AssinaturaClient — link de pagamento do Pix", () => {
  it("não aparece antes de assinar", () => {
    render(<AssinaturaClient {...BASE} document="52998224725" />);
    expect(screen.queryByRole("link", { name: /pagar agora/i })).toBeNull();
  });

  it("aparece com o link da cobrança quando a action devolve pixUrl", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({
      ok: true,
      pixUrl: "https://sandbox.asaas.com/i/abc123",
    });

    render(<AssinaturaClient {...BASE} document="52998224725" />);
    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /assinar/i })[0]);
    });

    const link = await screen.findByRole("link", { name: /pagar agora/i });
    expect(link.getAttribute("href")).toBe("https://sandbox.asaas.com/i/abc123");
    // Abre em nova aba: o lojista não pode perder a sessão do painel pra pagar.
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
