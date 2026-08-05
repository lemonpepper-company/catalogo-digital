import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AssinaturaClient } from "@/app/painel/assinatura/AssinaturaClient";

vi.mock("@/app/actions/assinatura", () => ({
  iniciarAssinatura: vi.fn(),
  trocarPlano: vi.fn(),
  cancelarAssinatura: vi.fn(),
  salvarDocumento: vi.fn(),
  salvarEndereco: vi.fn(),
}));

vi.mock("@/app/actions/cep", () => ({
  buscarEndereco: vi.fn(),
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

    const botaoCicloAnual = screen.getByRole("button", { name: /cancele para trocar o ciclo/i });
    // Mesmo plano/ciclo diferente fica bloqueado sempre — trocarPlano(destino)
    // reusa store.billingCycle e não tem como agir aqui, com ou sem meio
    // escolhido.
    expect(botaoCicloAnual).toBeDisabled();

    fireEvent.click(botaoCicloAnual);
    expect(trocarPlano).not.toHaveBeenCalled();

    // upgrade real (Starter) só habilita depois de escolher um meio — igual
    // à primeira assinatura.
    const botaoUpgrade = screen.getByRole("button", { name: /assinar starter mensal/i });
    expect(botaoUpgrade).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));
    expect(botaoUpgrade).not.toBeDisabled();
  });
});

/**
 * trocarPlano cobra a diferença proporcional no meio que o lojista escolher
 * no clique — igual à primeira assinatura, sem trava nem meio pré-marcado.
 * O radio precisa ser um clique real: sem escolher, os botões de plano
 * ficam bloqueados mesmo já tendo uma assinatura em curso.
 */
describe("AssinaturaClient — meio de pagamento no upgrade", () => {
  it("loja com assinatura ativa: radios continuam livres, sem meio pré-selecionado", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    const radioCartao = screen.getByRole("radio", { name: /cart(ã|a)o/i });
    expect(radioCartao).not.toBeDisabled();
    expect(radioCartao).not.toBeChecked();
  });

  it("sem escolher o meio, os botões do outro plano ficam bloqueados", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    expect(screen.getByRole("button", { name: /assinar pro mensal/i })).toBeDisabled();
  });

  /**
   * pending_plan fica preenchido entre o clique em "Assinar" e o webhook
   * confirmar o pagamento — clicar de nano nesse meio tempo criaria uma
   * segunda cobrança avulsa em cima da que já está pendente. Achado pelo
   * usuário testando ao vivo: a tela dizia "Muda para Pro em 6 de setembro"
   * mas ainda deixava clicar em "Assinar Pro" de novo.
   */
  it("com troca de plano pendente, os botões de plano ficam bloqueados", async () => {
    const { trocarPlano } = await import("@/app/actions/assinatura");
    vi.mocked(trocarPlano).mockClear();

    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        pendingPlan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-06T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    const botoesPro = screen.getAllByRole("button", { name: /troca já em andamento/i });
    expect(botoesPro).toHaveLength(2); // Pro mensal e Pro anual
    for (const botao of botoesPro) {
      expect(botao).toBeDisabled();
      fireEvent.click(botao);
    }
    expect(trocarPlano).not.toHaveBeenCalled();
  });

  it("primeira assinatura pendente (Free → pago): também bloqueia clicar de novo", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockClear();

    render(<AssinaturaClient {...BASE} pendingPlan="starter" planExpiresAt={null} />);

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    const botoes = screen.getAllByRole("button", { name: /troca já em andamento/i });
    expect(botoes).toHaveLength(4); // Starter e Pro, mensal e anual
    for (const botao of botoes) {
      expect(botao).toBeDisabled();
      fireEvent.click(botao);
    }
    expect(iniciarAssinatura).not.toHaveBeenCalled();
  });

  it("escolhendo o meio, trocarPlano recebe o destino e o meio escolhido", async () => {
    const { trocarPlano } = await import("@/app/actions/assinatura");
    vi.mocked(trocarPlano).mockClear();
    vi.mocked(trocarPlano).mockResolvedValue({ ok: true });

    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /assinar pro mensal/i }));
    });
    expect(trocarPlano).toHaveBeenCalledWith("pro", "PIX");
  });
});

/**
 * Cancelar deleta a assinatura no Asaas mas mantém o acesso até
 * plan_expires_at — então "plan" continua não sendo "free" por um tempo,
 * mesmo sem nenhuma assinatura viva pra trocarPlano atualizar. Sem tratar
 * esse caso, o clique caía em trocarPlano tentando mexer numa assinatura já
 * deletada e quebrava (achado pelo usuário perguntando sobre a experiência
 * de cancelar e assinar de novo).
 */
describe("AssinaturaClient — assinar de novo depois de cancelar (ainda com acesso pago)", () => {
  it("cancelada: assinar chama iniciarAssinatura, não trocarPlano", async () => {
    const { iniciarAssinatura, trocarPlano } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockClear();
    vi.mocked(trocarPlano).mockClear();
    vi.mocked(iniciarAssinatura).mockResolvedValue({ ok: true, redirectUrl: "https://x.com" });

    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="canceled"
        planExpiresAt="2026-12-01T00:00:00.000Z"
        billingCycle="monthly"
        document="52998224725"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /assinar pro mensal/i }));
    });

    expect(iniciarAssinatura).toHaveBeenCalledWith("pro", "monthly", "CREDIT_CARD");
    expect(trocarPlano).not.toHaveBeenCalled();
  });

  it("cancelada: o mesmo plano/ciclo de antes não trava com 'cancele para trocar o ciclo' — já está cancelada", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="canceled"
        planExpiresAt="2026-12-01T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    expect(screen.queryByRole("button", { name: /cancele para trocar o ciclo/i })).toBeNull();
  });

  /**
   * cancelarAssinatura agora limpa pending_plan no servidor — sem espelhar
   * isso no estado local (pending), os botões continuavam travados em
   * "Troca já em andamento" até um refresh da página, mesmo a cobrança já
   * tendo sumido.
   */
  it("cancelar uma troca pendente destrava os botões sem precisar recarregar a página", async () => {
    const { cancelarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(cancelarAssinatura).mockResolvedValue({ ok: true });

    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        pendingPlan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    expect(screen.getAllByRole("button", { name: /troca já em andamento/i }).length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /cancelar assinatura/i }));
    });

    expect(screen.queryByRole("button", { name: /troca já em andamento/i })).toBeNull();
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

/**
 * pixPendente vem do servidor (buscado no Asaas a cada carregamento da
 * página) — sem ele, a cobrança do segundo ciclo em diante nunca reaparecia
 * na tela, só a do clique inicial (pixUrl, que some ao navegar/recarregar).
 */
describe("AssinaturaClient — cobrança Pix pendente vinda do servidor", () => {
  it("mostra o link e o vencimento quando a página já carrega com uma cobrança em aberto", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
        pixPendente={{ invoiceUrl: "https://sandbox.asaas.com/i/renovacao1", dueDate: "2026-08-06" }}
      />
    );

    const link = screen.getByRole("link", { name: /pagar agora/i });
    expect(link.getAttribute("href")).toBe("https://sandbox.asaas.com/i/renovacao1");
    expect(screen.getByText(/vencimento em 6 de agosto de 2026/i)).toBeTruthy();
  });

  it("sem cobrança pendente, o card não aparece", () => {
    render(<AssinaturaClient {...BASE} plan="pro" subscriptionStatus="active" pixPendente={null} />);
    expect(screen.queryByRole("link", { name: /pagar agora/i })).toBeNull();
  });

  it("pixUrl do clique tem prioridade sobre pixPendente do servidor", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({
      ok: true,
      pixUrl: "https://sandbox.asaas.com/i/novo",
    });

    render(
      <AssinaturaClient
        {...BASE}
        document="52998224725"
        pixPendente={{ invoiceUrl: "https://sandbox.asaas.com/i/antigo", dueDate: "2026-08-06" }}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /assinar/i })[0]);
    });

    const link = await screen.findByRole("link", { name: /pagar agora/i });
    expect(link.getAttribute("href")).toBe("https://sandbox.asaas.com/i/novo");
  });
});
