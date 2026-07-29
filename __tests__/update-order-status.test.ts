import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan, StoreSettings } from "@/lib/types";

const from = vi.fn();
const getUser = vi.fn();
const getCurrentStore = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from, auth: { getUser } }),
}));
vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "55555555-5555-4555-8555-555555555555";

type Result = { data?: unknown; error?: unknown };

interface FakeChain {
  calls: Record<string, unknown[][]>;
  [key: string]: unknown;
}

function makeChain(result: Result): FakeChain {
  const calls: Record<string, unknown[][]> = {};
  const chain = { calls } as FakeChain;
  for (const method of ["update", "eq", "select"] as const) {
    chain[method] = (...args: unknown[]) => {
      (calls[method] ??= []).push(args);
      return chain;
    };
  }
  chain.then = (resolve: (value: Result) => unknown, reject?: () => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

let chain: FakeChain;

function setupOrders(result: Result = { data: [{ id: ORDER_ID }], error: null }) {
  chain = makeChain(result);
  from.mockImplementation(() => chain);
}

function makeStore(plan: Plan, trialEndsAt: string | null = null): StoreSettings {
  return {
    id: STORE_ID,
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan,
    trialEndsAt,
    whatsapp: "35999999999",
    accentColor: "#C9A96E",
    logoUrl: null,
    coverUrl: null,
    description: null,
    monogram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
    fontPairing: "padrao",
    backgroundPalette: "padrao",
    cornerStyle: "padrao",
    secondaryColor: null,
    gridDensity: "padrao",
    customDomain: null,
    customDomainVerified: false,
  };
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function loadAction() {
  const mod = await import("@/app/actions/pedidos");
  return mod.updateOrderStatus;
}

function writeCalls(): unknown[][] {
  return chain?.calls.update ?? [];
}

beforeEach(() => {
  from.mockReset();
  getUser.mockReset();
  getCurrentStore.mockReset();
  revalidatePath.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  getCurrentStore.mockResolvedValue(makeStore("starter"));
  setupOrders();
});

describe("updateOrderStatus — persistência (ORD-21)", () => {
  it("atualiza só a coluna status do pedido da própria loja e retorna ok:true", async () => {
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(
      null,
      formData({ id: ORDER_ID, status: "confirmado" })
    );

    expect(result).toEqual({ ok: true });
    expect(writeCalls()).toEqual([[{ status: "confirmado" }]]);
    expect(chain.calls.eq).toEqual([
      ["id", ORDER_ID],
      ["store_id", STORE_ID],
    ]);
  });

  it("revalida a lista de pedidos e o dashboard no sucesso", async () => {
    const updateOrderStatus = await loadAction();

    await updateOrderStatus(null, formData({ id: ORDER_ID, status: "cancelado" }));

    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/painel/pedidos",
      "/painel",
    ]);
  });

  it("retorna erro quando o update falha no banco", async () => {
    setupOrders({ data: null, error: { message: "boom" } });
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(
      null,
      formData({ id: ORDER_ID, status: "confirmado" })
    );

    expect(result).toEqual({ error: "Erro ao atualizar o status do pedido." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateOrderStatus — transições e validação (ORD-22)", () => {
  it.each(["pendente", "confirmado", "cancelado"])(
    "aceita a transição para %s",
    async (status) => {
      const updateOrderStatus = await loadAction();

      const result = await updateOrderStatus(null, formData({ id: ORDER_ID, status }));

      expect(result).toEqual({ ok: true });
      expect(writeCalls()).toEqual([[{ status }]]);
    }
  );

  it("rejeita status fora do enum sem alterar nenhuma linha", async () => {
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(
      null,
      formData({ id: ORDER_ID, status: "entregue" })
    );

    expect(result).toEqual({ error: "Status inválido." });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejeita pedido sem id sem alterar nenhuma linha", async () => {
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(null, formData({ status: "confirmado" }));

    expect(result).toEqual({ error: "Pedido inválido." });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("updateOrderStatus — isolamento por loja e sessão (ORD-23)", () => {
  it("retorna erro quando o pedido não é da loja do usuário (0 linhas afetadas)", async () => {
    setupOrders({ data: [], error: null });
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(
      null,
      formData({ id: ORDER_ID, status: "confirmado" })
    );

    expect(result).toEqual({ error: "Pedido não encontrado." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("restringe o update ao store_id da loja autenticada", async () => {
    const updateOrderStatus = await loadAction();

    await updateOrderStatus(null, formData({ id: ORDER_ID, status: "confirmado" }));

    expect(chain.calls.eq).toContainEqual(["store_id", STORE_ID]);
  });

  it("rejeita sem sessão, sem alterar nenhuma linha", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(
      null,
      formData({ id: ORDER_ID, status: "confirmado" })
    );

    expect(result).toEqual({ error: "Não autenticado." });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("updateOrderStatus — gate de plano (ORD-28, ORD-30)", () => {
  it("recusa a mudança de status no plano Free sem escrever nada", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(
      null,
      formData({ id: ORDER_ID, status: "confirmado" })
    );

    expect(result).toEqual({
      error: "Histórico de pedidos disponível a partir do plano Starter.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("recusa a mudança quando o acesso pago da loja expirou", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter", "2020-01-01T00:00:00.000Z"));
    const updateOrderStatus = await loadAction();

    const result = await updateOrderStatus(
      null,
      formData({ id: ORDER_ID, status: "confirmado" })
    );

    expect(result).toEqual({
      error: "Histórico de pedidos disponível a partir do plano Starter.",
    });
    expect(from).not.toHaveBeenCalled();
  });
});
