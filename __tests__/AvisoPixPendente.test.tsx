import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const getPixPendente = vi.fn();

vi.mock("@/lib/server/assinatura", () => ({
  getPixPendente: (...args: unknown[]) => getPixPendente(...args),
}));

async function renderAviso(
  props: { asaasSubscriptionId: string | null; subscriptionStatus: string | null } = {
    asaasSubscriptionId: "sub_1",
    subscriptionStatus: "active",
  }
) {
  const { AvisoPixPendente } = await import("@/components/painel/AvisoPixPendente");
  const ui = await AvisoPixPendente(props);
  return render(ui);
}

beforeEach(() => {
  getPixPendente.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Pix não é débito automático: o Asaas gera a cobrança sozinho a cada
 * ciclo, mas quem paga é o lojista. Sem este aviso, o lojista só descobre a
 * cobrança pendente se lembrar de abrir a tela de Assinatura por conta
 * própria.
 *
 * Só entra no ar perto do vencimento (3 dias antes, mesma janela da graça
 * que já existe depois) — o Asaas gera a cobrança com bem mais antecedência
 * (até 40 dias, por padrão deles), e avisar tão cedo seria ruído sem nenhum
 * bloqueio em jogo. "hoje" fixado em 2026-08-05T12:00 (fake timer) pra não
 * depender da data real do sistema rodando o teste.
 */
describe("AvisoPixPendente", () => {
  it("vencimento amanhã (dentro da janela de 3 dias) mostra o banner com o link e a data", async () => {
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/abc123",
      dueDate: "2026-08-06",
    });

    await renderAviso();

    expect(getPixPendente).toHaveBeenCalledWith("sub_1", "active");
    expect(screen.getByText(/pagamento pix pendente/i)).toBeTruthy();
    expect(screen.getByText(/vencimento em 6 de agosto de 2026/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /pagar agora/i });
    expect(link.getAttribute("href")).toBe("https://sandbox.asaas.com/i/abc123");
  });

  it("vencimento já passado (vencida) mostra o banner", async () => {
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/vencida1",
      dueDate: "2026-08-01",
    });

    await renderAviso({ asaasSubscriptionId: "sub_1", subscriptionStatus: "past_due" });

    expect(screen.getByText(/pagamento pix pendente/i)).toBeTruthy();
  });

  it("vencimento em exatamente 3 dias (borda da janela) mostra o banner", async () => {
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/borda1",
      dueDate: "2026-08-08",
    });

    await renderAviso();

    expect(screen.getByText(/pagamento pix pendente/i)).toBeTruthy();
  });

  it("vencimento daqui a 4 dias (fora da janela) não mostra o banner ainda", async () => {
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/longe1",
      dueDate: "2026-08-09",
    });

    const { container } = await renderAviso();

    expect(container).toBeEmptyDOMElement();
  });

  it("sem cobrança pendente, não renderiza nada", async () => {
    getPixPendente.mockResolvedValue(null);

    const { container } = await renderAviso();

    expect(container).toBeEmptyDOMElement();
  });

  it("sem asaasSubscriptionId, nem chama getPixPendente", async () => {
    getPixPendente.mockResolvedValue(null);

    await renderAviso({ asaasSubscriptionId: null, subscriptionStatus: null });

    expect(getPixPendente).toHaveBeenCalledWith(null, null);
    expect(screen.queryByText(/pagamento pix pendente/i)).toBeNull();
  });
});
