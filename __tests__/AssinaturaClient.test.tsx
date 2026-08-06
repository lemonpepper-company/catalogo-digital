import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
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

  /**
   * Sem plano/ciclo na mensagem, nada na tela dizia qual plano o lojista tem
   * quando status === "canceled" (o botão "Plano atual" só aparece com
   * status === "active").
   */
  it("mensagem de status inclui plano e ciclo nos três estados", () => {
    // Cada estado precisa da sua própria instância — `status` nasce de
    // useState(subscriptionStatus), que só lê a prop inicial no mount.
    const { unmount: unmountAtiva } = render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="annual"
      />
    );
    expect(screen.getByText(/pro anual — renova em 12 de setembro/i)).toBeTruthy();
    unmountAtiva();

    const { unmount: unmountAtraso } = render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="past_due"
        planExpiresAt="2026-08-15T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/pro mensal —.*cobran(ç|c)a falhou/i)).toBeTruthy();
    unmountAtraso();

    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="canceled"
        planExpiresAt="2026-08-30T00:00:00.000Z"
        billingCycle="annual"
      />
    );
    expect(screen.getByText(/pro anual — termina em 30 de agosto/i)).toBeTruthy();
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
        plan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    // Starter anual (mesmo plano) e Pro anual (fix do bug de ciclo em
    // qualquer plano) compartilham o mesmo texto — o primeiro é o do Starter.
    const botaoCicloAnual = screen.getAllByRole("button", { name: /cancele para trocar o ciclo/i })[0];
    // Mesmo plano/ciclo diferente fica bloqueado sempre — trocarPlano(destino)
    // reusa store.billingCycle e não tem como agir aqui, com ou sem meio
    // escolhido.
    expect(botaoCicloAnual).toBeDisabled();

    fireEvent.click(botaoCicloAnual);
    expect(trocarPlano).not.toHaveBeenCalled();

    // upgrade real (Pro) só habilita depois de escolher um meio — igual
    // à primeira assinatura.
    const botaoUpgrade = screen.getByRole("button", { name: /assinar pro mensal/i });
    expect(botaoUpgrade).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));
    expect(botaoUpgrade).not.toBeDisabled();
  });
});

/**
 * trocarPlano(destino, meio) não recebe ciclo — lê store.billingCycle no
 * servidor. A trava antiga só cobria o mesmo plano (`plan === p`), então
 * Starter anual → Pro mensal passava, pagava a diferença calculada sobre
 * preços anuais e terminava em Pro anual sem aviso. A trava agora cobre
 * qualquer plano.
 */
describe("AssinaturaClient — troca de ciclo bloqueada para qualquer plano", () => {
  it("Starter anual ativo → Pro mensal desabilitado; Pro anual habilitado", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="annual"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    // Bloqueado: não tem mais o texto "Assinar", vira o aviso de ciclo.
    expect(screen.queryByRole("button", { name: /assinar pro mensal/i })).toBeNull();
    const botaoProMensal = screen.getAllByRole("button", { name: /cancele para trocar o ciclo/i })[1];
    expect(botaoProMensal).toBeDisabled();
    expect(botaoProMensal.getAttribute("title")).toMatch(/anual/i);

    const botaoProAnual = screen.getByRole("button", { name: /assinar pro anual/i });
    expect(botaoProAnual).not.toBeDisabled();
  });
});

/**
 * Decisão de produto: Pro não troca para Starter — quem quiser reduzir
 * cancela e assina o menor depois.
 */
describe("AssinaturaClient — downgrade de plano bloqueado", () => {
  it("Pro ativo → botão do Starter desabilitado, com tooltip explicando", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    expect(screen.queryByRole("button", { name: /assinar starter mensal/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /assinar starter anual/i })).toBeNull();

    const botoesStarter = screen.getAllByRole("button", { name: /cancele para reduzir o plano/i });
    expect(botoesStarter).toHaveLength(2); // Starter mensal e anual
    for (const botao of botoesStarter) {
      expect(botao).toBeDisabled();
      expect(botao.getAttribute("title")).toMatch(/menor/i);
    }
  });
});

/**
 * Cancelar mantém o acesso até plan_expires_at — assinar de novo no mesmo
 * período pagaria duas vezes o mesmo intervalo. Mas bloquear tudo impediria
 * o lojista de pagar mais (upgrade), então só o upgrade fica liberado.
 */
describe("AssinaturaClient — assinatura cancelada, mas ainda no período pago", () => {
  it("Starter cancelado com prazo no futuro → botão do Pro habilitado", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="canceled"
        planExpiresAt="2099-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    expect(screen.getByRole("button", { name: /assinar pro mensal/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /assinar pro anual/i })).not.toBeDisabled();
  });

  it("Starter cancelado com prazo no futuro → botão do Starter desabilitado", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="canceled"
        planExpiresAt="2099-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    const botoesStarter = screen.getAllByRole("button", { name: /aguarde a renova(ç|c)(ã|a)o/i });
    expect(botoesStarter).toHaveLength(2); // Starter mensal e anual
    for (const botao of botoesStarter) {
      expect(botao).toBeDisabled();
      expect(botao.getAttribute("title")).toMatch(/já tem starter/i);
    }
  });

  it("Pro cancelado com prazo no futuro → todos desabilitados", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="canceled"
        planExpiresAt="2099-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    // Nenhum botão de plano oferece "Assinar ..." — os quatro (Starter e
    // Pro, mensal e anual) estão bloqueados pelo período pago em curso.
    for (const nome of [
      /assinar starter mensal/i,
      /assinar starter anual/i,
      /assinar pro mensal/i,
      /assinar pro anual/i,
    ]) {
      expect(screen.queryByRole("button", { name: nome })).toBeNull();
    }

    const todosOsBotoesDePlano = [
      ...screen.getAllByRole("button", { name: /aguarde a renova(ç|c)(ã|a)o/i }),
      ...screen.getAllByRole("button", { name: /aguarde o fim do per(í|i)odo/i }),
    ];
    expect(todosOsBotoesDePlano).toHaveLength(4);
    for (const botao of todosOsBotoesDePlano) {
      expect(botao).toBeDisabled();
    }
  });

  it("qualquer plano com prazo no passado → todos habilitados", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="canceled"
        planExpiresAt="2020-01-01T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    for (const nome of [
      /assinar starter mensal/i,
      /assinar starter anual/i,
      /assinar pro mensal/i,
      /assinar pro anual/i,
    ]) {
      expect(screen.getByRole("button", { name: nome })).not.toBeDisabled();
    }
  });
});

describe("AssinaturaClient — cada bloqueio tem tooltip explicativo", () => {
  it("botão bloqueado por troca de ciclo tem título explicando o motivo", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="annual"
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));
    const botao = screen.getAllByRole("button", { name: /cancele para trocar o ciclo/i })[0];
    expect(botao.getAttribute("title")).toBeTruthy();
    expect(botao.getAttribute("title")).not.toBe("");
  });

  /**
   * O plano pendente em si não bloqueia mais (vira retomada — ver "retomar
   * checkout de cartão abandonado" abaixo). Para exercitar um bloqueio de
   * verdade por troca pendente, uso um terceiro plano fora do par
   * plan/pending — aqui, a primeira assinatura (Free → Starter pendente)
   * deixa Pro bloqueado, que não é nem o atual nem o pendente.
   */
  it("botão bloqueado por troca pendente tem título explicando o motivo", () => {
    render(<AssinaturaClient {...BASE} pendingPlan="starter" planExpiresAt={null} />);
    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));
    const botao = screen.getAllByRole("button", { name: /troca já em andamento/i })[0];
    expect(botao.getAttribute("title")).toBeTruthy();
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
   * confirmar o pagamento — clicar de novo nesse meio tempo criaria uma
   * segunda cobrança avulsa em cima da que já está pendente. Achado pelo
   * usuário testando ao vivo: a tela dizia "Muda para Pro em 6 de setembro"
   * mas ainda deixava clicar em "Assinar Pro" de novo. O plano pendente em
   * si, porém, agora libera como retomada (ver describe abaixo) — aqui só
   * um terceiro plano (Pro, fora do par Starter atual/Starter pendente)
   * segue bloqueado de verdade.
   */
  it("com troca de plano pendente, o plano fora do par atual/pendente fica bloqueado", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockClear();

    render(<AssinaturaClient {...BASE} pendingPlan="starter" planExpiresAt={null} />);

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    const botoes = screen.getAllByRole("button", { name: /troca já em andamento/i });
    expect(botoes).toHaveLength(2); // Pro mensal e anual — Starter (o pendente) virou retomada
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
 * Trocar o meio no meio de uma contratação em andamento não muda a cobrança
 * já criada, mas passa a impressão de que mudou — os rádios travam enquanto
 * um clique está em voo ou uma troca aguarda confirmação do webhook.
 */
describe("AssinaturaClient — rádios de meio travados durante processamento", () => {
  it("com loadingKey setado (clique em andamento), os rádios ficam desabilitados", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    let resolver: (value: { ok: true }) => void = () => {};
    vi.mocked(iniciarAssinatura).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve;
      })
    );

    render(<AssinaturaClient {...BASE} document="52998224725" />);
    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    fireEvent.click(screen.getByRole("button", { name: /assinar starter mensal/i }));

    expect(screen.getByRole("radio", { name: /cart(ã|a)o/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /pix/i })).toBeDisabled();

    await act(async () => {
      resolver({ ok: true });
    });
  });

  it("com pending setado, os rádios ficam desabilitados", () => {
    render(<AssinaturaClient {...BASE} pendingPlan="starter" planExpiresAt={null} />);

    expect(screen.getByRole("radio", { name: /cart(ã|a)o/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /pix/i })).toBeDisabled();
  });

  it("sem loading e sem pending, os rádios seguem livres", () => {
    render(<AssinaturaClient {...BASE} document="52998224725" />);

    expect(screen.getByRole("radio", { name: /cart(ã|a)o/i })).not.toBeDisabled();
    expect(screen.getByRole("radio", { name: /pix/i })).not.toBeDisabled();
  });
});

/**
 * Se o lojista fecha a página do Asaas sem pagar, pending_plan fica gravado
 * e o botão daquele mesmo plano ficava travado pra sempre em "Troca já em
 * andamento", sem meio de retomar. Diferente do Pix (que já tem uma cobrança
 * real em aberto, mostrada em pixPendente), no cartão nunca existe cobrança
 * nenhuma enquanto o checkout não é concluído — retomar é seguro.
 */
describe("AssinaturaClient — retomar checkout de cartão abandonado", () => {
  it("pending_plan setado → botão daquele plano habilitado, com rótulo de retomada", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockClear();
    vi.mocked(iniciarAssinatura).mockResolvedValue({ ok: true, redirectUrl: "https://x.com" });

    render(<AssinaturaClient {...BASE} pendingPlan="starter" planExpiresAt={null} />);

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    const botao = screen.getByRole("button", { name: /retomar pagamento.*starter mensal/i });
    expect(botao).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(botao);
    });
    expect(iniciarAssinatura).toHaveBeenCalledWith("starter", "monthly", "CREDIT_CARD");
  });

  it("pending_plan setado → botões dos outros planos seguem bloqueados", () => {
    render(<AssinaturaClient {...BASE} pendingPlan="starter" planExpiresAt={null} />);

    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    const botoesPro = screen.getAllByRole("button", { name: /troca já em andamento/i });
    expect(botoesPro).toHaveLength(2);
    for (const botao of botoesPro) {
      expect(botao).toBeDisabled();
    }
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

    // plan=free/pending=starter: Pro fica bloqueado de verdade por troca
    // pendente (Starter, o próprio pendente, já libera como retomada).
    render(
      <AssinaturaClient
        {...BASE}
        pendingPlan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
      />
    );

    expect(screen.getAllByRole("button", { name: /troca já em andamento/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^cancelar assinatura$/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sim, cancelar assinatura/i }));
    });

    expect(screen.queryByRole("button", { name: /troca já em andamento/i })).toBeNull();
  });
});

/**
 * Cancelamento é imediato no servidor, sem passo intermediário — a
 * confirmação evita o clique por engano que só é percebido depois (e vira
 * chamado de suporte). Assinar/trocar de propósito não ganha esse passo: o
 * checkout do Asaas já é a confirmação.
 */
describe("AssinaturaClient — confirmação antes de cancelar", () => {
  it("clicar em cancelar abre confirmação e não chama a action antes do 'confirmar'", async () => {
    const { cancelarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(cancelarAssinatura).mockClear();

    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^cancelar assinatura$/i }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(cancelarAssinatura).not.toHaveBeenCalled();
  });

  it("confirmação de cancelamento mostra até quando o acesso vale", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^cancelar assinatura$/i }));

    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByText(/12 de setembro/i)).toBeTruthy();
    expect(dialogo.getByText(/n(ã|a)o (é|e) interrompida agora/i)).toBeTruthy();
  });

  it("confirmar cancelamento chama a action e fecha a confirmação", async () => {
    const { cancelarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(cancelarAssinatura).mockClear();
    vi.mocked(cancelarAssinatura).mockResolvedValue({ ok: true });

    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^cancelar assinatura$/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sim, cancelar assinatura/i }));
    });

    expect(cancelarAssinatura).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("assinar/trocar não abre confirmação", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({ ok: true, redirectUrl: "https://x.com" });

    render(<AssinaturaClient {...BASE} document="52998224725" />);
    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /assinar starter mensal/i }));
    });

    expect(screen.queryByRole("dialog")).toBeNull();
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
 * Campo obrigatório vazio na modal de endereço produzia uma única mensagem
 * vermelha no topo, sem indicar qual campo falta — o Input já suporta
 * `error` por campo, só não era usado. A mensagem geral no topo continua
 * existindo, mas só para falhas que não pertencem a um campo (rede, Asaas).
 */
describe("AssinaturaClient — modal de endereço, erros por campo", () => {
  async function abrirModalEndereco() {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({ error: "ENDERECO_NECESSARIO" });

    render(<AssinaturaClient {...BASE} document="52998224725" />);
    fireEvent.click(screen.getByRole("radio", { name: /cart(ã|a)o/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /assinar/i })[0]);
    await screen.findByRole("dialog");
  }

  it("campo obrigatório vazio mostra o erro no campo, não só no topo", async () => {
    await abrirModalEndereco();
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    vi.mocked(salvarEndereco).mockResolvedValue({ error: "Número é obrigatório." });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    });

    expect(screen.getByText("Número é obrigatório.")).toBeTruthy();
    // Erro de campo não usa role="alert" — só a mensagem geral do topo usa,
    // e ela não deveria aparecer para um erro que pertence a um campo.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("editar o campo com erro limpa o erro daquele campo", async () => {
    await abrirModalEndereco();
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    vi.mocked(salvarEndereco).mockResolvedValue({ error: "Rua é obrigatória." });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    });
    expect(screen.getByText("Rua é obrigatória.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^rua$/i), { target: { value: "Rua Nova" } });

    expect(screen.queryByText("Rua é obrigatória.")).toBeNull();
  });

  it("erro que não pertence a um campo (ex.: falha ao gravar) aparece como mensagem geral", async () => {
    await abrirModalEndereco();
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    vi.mocked(salvarEndereco).mockResolvedValue({ error: "Não foi possível salvar o endereço." });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível salvar o endereço.");
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
