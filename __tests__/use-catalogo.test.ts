import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalogo, ORDER_CAPTURE_TIMEOUT_MS } from "@/app/[slug]/use-catalogo";
import { renderWhatsAppMessage, normalizeWhatsapp } from "@/lib/utils";
import { deriveOrderCode, ORDER_CODE_PATTERN } from "@/lib/orders";
import type { Product, Store } from "@/lib/types";
import { resolveTheme } from "@/lib/theme-options";
import { getPlanLimits } from "@/lib/plan-limits";

const registrarPedido = vi.fn();

vi.mock("@/app/actions/pedidos", () => ({
  registrarPedido: (payload: unknown) => registrarPedido(payload),
}));

// A telemetria é mockada aqui em vez de deixar o client real rodar: ele importa a
// Server Action, que por sua vez importa o admin client `server-only`.
const trackEvent = vi.fn();
const shouldTrackVisit = vi.fn(() => true);

vi.mock("@/lib/analytics-client", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  shouldTrackVisit: (slug: string) => shouldTrackVisit(slug),
}));

/** Chamadas de trackEvent de um tipo de evento, sem o ruído dos demais. */
function eventsOf(eventType: string): unknown[][] {
  return trackEvent.mock.calls.filter((call) => call[1] === eventType);
}

beforeEach(() => {
  trackEvent.mockReset();
  shouldTrackVisit.mockReset();
  shouldTrackVisit.mockReturnValue(true);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const baseStore: Store = {
  name: "Ateliê Mira",
  slug: "ateliemira",
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos"],
  description: "",
  accentColor: "#C9A96E",
  catalogUrl: "vtrinedigital.com.br/ateliemira",
  theme: resolveTheme("padrao", "padrao", "padrao", null, getPlanLimits("free", null)),
  gridDensity: "padrao",
  hasAnalytics: true,
};

const products: Product[] = [];

/** O nome é obrigatório desde ORD-31 — sem ele nenhum outro caminho libera o envio. */
function withName(result: { current: ReturnType<typeof useCatalogo> }, name = "Ana") {
  act(() => result.current.setCustomerName(name));
}

describe("useCatalogo — canCheckout com pagamento e entrega (novo)", () => {
  it("fica false quando a loja não tem whatsapp, mesmo sem pagamento/entrega configurados", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, whatsapp: "" }, products })
    );
    withName(result);
    expect(result.current.canCheckout).toBe(false);
  });

  it("fica true com whatsapp e nome, sem pagamento/entrega configurados", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    withName(result);
    expect(result.current.canCheckout).toBe(true);
  });

  it("fica false quando há formas de pagamento configuradas e nenhuma selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, paymentMethods: ["pix", "cartao"] }, products })
    );
    withName(result);
    expect(result.current.canCheckout).toBe(false);
  });

  it("fica true após selecionar uma forma de pagamento", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, paymentMethods: ["pix", "cartao"] }, products })
    );
    withName(result);
    act(() => result.current.setSelectedPayment("pix"));
    expect(result.current.canCheckout).toBe(true);
  });

  it("exige endereço quando 'entrega' é selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, deliveryMethods: ["retirada", "entrega"] }, products })
    );
    withName(result);
    act(() => result.current.setSelectedDelivery("entrega"));
    expect(result.current.canCheckout).toBe(false);
    act(() => result.current.setAddress("Rua X, 123"));
    expect(result.current.canCheckout).toBe(true);
  });

  it("não exige endereço quando 'retirada' é selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, deliveryMethods: ["retirada", "entrega"] }, products })
    );
    withName(result);
    act(() => result.current.setSelectedDelivery("retirada"));
    expect(result.current.canCheckout).toBe(true);
  });
});

describe("useCatalogo — nome obrigatório no checkout (ORD-31.3)", () => {
  it("fica false com o campo de nome vazio, mesmo com tudo o mais resolvido", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    expect(result.current.customerName).toBe("");
    expect(result.current.canCheckout).toBe(false);
    expect(result.current.checkoutBlockedReason).toBe("Informe seu nome para continuar");
  });

  it("fica false com o campo de nome só com espaços", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    withName(result, "    ");
    expect(result.current.canCheckout).toBe(false);
    expect(result.current.checkoutBlockedReason).toBe("Informe seu nome para continuar");
  });

  it("fica false com menos de 2 caracteres após o trim", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    withName(result, "  A  ");
    expect(result.current.canCheckout).toBe(false);
    expect(result.current.checkoutBlockedReason).toBe("Informe seu nome para continuar");
  });

  it("libera o envio a partir de 2 caracteres após o trim", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    withName(result, "  An  ");
    expect(result.current.canCheckout).toBe(true);
    expect(result.current.checkoutBlockedReason).toBeNull();
  });
});

describe("useCatalogo — checkoutBlockedReason (novo)", () => {
  it("fica null quando canCheckout é true", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    withName(result);
    expect(result.current.canCheckout).toBe(true);
    expect(result.current.checkoutBlockedReason).toBeNull();
  });

  it("fica null quando a loja não tem whatsapp (mensagem fica a cargo do BagDrawer)", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, whatsapp: "" }, products })
    );
    expect(result.current.checkoutBlockedReason).toBeNull();
  });

  it("informa para selecionar pagamento/entrega quando só faltam as seleções", () => {
    const { result } = renderHook(() =>
      useCatalogo({
        store: { ...baseStore, paymentMethods: ["pix", "cartao"] },
        products,
      })
    );
    withName(result);
    expect(result.current.canCheckout).toBe(false);
    expect(result.current.checkoutBlockedReason).toBe(
      "Selecione forma de pagamento e entrega para continuar."
    );
  });
});

const productA: Product = {
  id: "p1",
  name: "Blusa",
  price: "R$ 80,00",
  category: "Blusas",
  image: "https://example.com/p1.jpg",
  desc: "",
  sizes: [],
  soldSizes: [],
  colors: [],
  isFeatured: false,
};

const productB: Product = {
  ...productA,
  id: "p2",
  name: "Saia",
  price: "R$ 120,00",
};

interface FakeTab {
  location: { href: string };
}

function newTab(): FakeTab {
  return { location: { href: "" } };
}

function openMock() {
  return window.open as unknown as ReturnType<typeof vi.fn>;
}

/** Payload enviado à Server Action na chamada `index`. */
function capturePayload(index = 0): Record<string, unknown> {
  return registrarPedido.mock.calls[index][0] as Record<string, unknown>;
}

describe("useCatalogo — handleCheckout com pagamento e entrega (novo)", () => {
  let tab: FakeTab;

  beforeEach(() => {
    registrarPedido.mockReset();
    registrarPedido.mockResolvedValue({ ok: true });
    tab = newTab();
    vi.stubGlobal("open", vi.fn(() => tab));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inclui pagamento e entrega selecionados na mensagem enviada", async () => {
    const store: Store = {
      ...baseStore,
      paymentMethods: ["pix"],
      deliveryMethods: ["retirada"],
    };
    const { result } = renderHook(() => useCatalogo({ store, products: [productA] }));
    act(() => result.current.handleAdd(productA, null, null, 1));
    act(() => result.current.setSelectedPayment("pix"));
    act(() => result.current.setSelectedDelivery("retirada"));
    await act(async () => {
      await result.current.handleCheckout();
    });

    const message = decodeURIComponent(tab.location.href.split("?text=")[1]);
    expect(message).toContain("Forma de pagamento: Pix");
    expect(message).toContain("Entrega: Retirar no local");
  });
});

describe("useCatalogo — captura do pedido no checkout (ORD-01, ORD-03, ORD-11)", () => {
  let tab: FakeTab;

  beforeEach(() => {
    registrarPedido.mockReset();
    registrarPedido.mockResolvedValue({ ok: true });
    tab = newTab();
    vi.stubGlobal("open", vi.fn(() => tab));
  });

  const originalLocation = Object.getOwnPropertyDescriptor(window, "location");

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (originalLocation) Object.defineProperty(window, "location", originalLocation);
  });

  function setupCheckout(store: Store = baseStore) {
    const { result } = renderHook(() => useCatalogo({ store, products: [productA] }));
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    return result;
  }

  it("abre a aba em branco sincronamente no clique, antes de qualquer await", () => {
    const result = setupCheckout();

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.handleCheckout();
    });

    expect(openMock()).toHaveBeenCalledWith("", "_blank");
    expect(tab.location.href).toBe("");
    return pending;
  });

  it("envia slug, clientOrderId, nome, pagamento, entrega e itens sem nenhum campo de preço", async () => {
    const store: Store = {
      ...baseStore,
      paymentMethods: ["pix"],
      deliveryMethods: ["entrega"],
    };
    const result = setupCheckout(store);
    act(() => result.current.setSelectedPayment("pix"));
    act(() => result.current.setSelectedDelivery("entrega"));
    act(() => result.current.setAddress("  Rua X, 123  "));
    act(() => result.current.setCustomerName("  Ana  "));

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(capturePayload()).toEqual({
      slug: "ateliemira",
      clientOrderId: expect.stringMatching(UUID_RE),
      customerName: "Ana",
      payment: "pix",
      delivery: "entrega",
      address: "Rua X, 123",
      items: [{ productId: "p1", size: "M", color: "Areia", qty: 2 }],
    });
  });

  // ORD-32.1 (revisada): o código vai na MENSAGEM, não no payload — o servidor
  // deriva o mesmo valor do client_order_id. Nada vindo do cliente alcança
  // orders.code, e a mensagem segue completa sem depender do servidor.
  it("põe o código na mensagem e NÃO o envia no payload (ORD-32.1)", async () => {
    const result = setupCheckout();
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    const payload = capturePayload();
    expect(payload).not.toHaveProperty("code");

    const expected = deriveOrderCode(payload.clientOrderId as string);
    expect(expected).toMatch(ORDER_CODE_PATTERN);
    const message = decodeURIComponent(tab.location.href.split("?text=")[1]);
    expect(message).toContain(`Pedido: ${expected}`);
  });

  it("leva nome e código na mensagem do WhatsApp (ORD-31.5, ORD-32.1)", async () => {
    const result = setupCheckout();
    act(() => result.current.setCustomerName("  Ana  "));

    await act(async () => {
      await result.current.handleCheckout();
    });

    const message = decodeURIComponent(tab.location.href.split("?text=")[1]);
    expect(message).toContain("Cliente: Ana");
    expect(message).toContain(
      `Pedido: ${deriveOrderCode(capturePayload().clientOrderId as string)}`
    );
  });

  it("envia null (nunca string vazia) em nome, pagamento, entrega e endereço não informados", async () => {
    const result = setupCheckout();

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(capturePayload()).toMatchObject({
      customerName: null,
      payment: null,
      delivery: null,
      address: null,
    });
  });

  it("aponta a aba pré-aberta para a URL do WhatsApp com a mensagem atual, com nome e código (ORD-31.5)", async () => {
    const result = setupCheckout();
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    const expectedMsg = renderWhatsAppMessage(baseStore.messageTemplate, result.current.cart, {
      payment: null,
      delivery: null,
      address: "",
      customerName: "Ana",
      code: deriveOrderCode(capturePayload().clientOrderId as string),
    });
    expect(tab.location.href).toBe(
      `https://wa.me/${normalizeWhatsapp(baseStore.whatsapp)}?text=${encodeURIComponent(expectedMsg)}`
    );
    expect(decodeURIComponent(tab.location.href)).toContain("Ana");
  });

  it("abre o WhatsApp igual quando a gravação rejeita, sem toast de erro (ORD-03)", async () => {
    registrarPedido.mockRejectedValue(new Error("500"));
    const result = setupCheckout();

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(tab.location.href).toContain("https://wa.me/5511999990000?text=");
    expect(result.current.toast).toBe("Abrindo o WhatsApp…");
  });

  it("mantém nome e código na mensagem quando a gravação falha (ORD-32.3)", async () => {
    registrarPedido.mockRejectedValue(new Error("500"));
    const result = setupCheckout();
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    const message = decodeURIComponent(tab.location.href.split("?text=")[1]);
    expect(message).toContain("Cliente: Ana");
    expect(message).toContain(`Pedido: ${deriveOrderCode(capturePayload().clientOrderId as string)}`);
  });

  it("mantém nome e código na mensagem quando a gravação estoura o timeout (ORD-32.3)", async () => {
    registrarPedido.mockReturnValue(new Promise(() => {}));
    const result = setupCheckout();
    act(() => result.current.setCustomerName("Ana"));
    vi.useFakeTimers();

    act(() => {
      void result.current.handleCheckout();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ORDER_CAPTURE_TIMEOUT_MS);
    });

    const message = decodeURIComponent(tab.location.href.split("?text=")[1]);
    expect(message).toContain("Cliente: Ana");
    expect(message).toContain(`Pedido: ${deriveOrderCode(capturePayload().clientOrderId as string)}`);
  });

  it("abre o WhatsApp igual quando a gravação retorna ok:false (ORD-03)", async () => {
    registrarPedido.mockResolvedValue({ ok: false });
    const result = setupCheckout();

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(tab.location.href).toContain("https://wa.me/5511999990000?text=");
    expect(result.current.toast).toBe("Abrindo o WhatsApp…");
  });

  it("abre o WhatsApp pelo timeout de 2500 ms quando a gravação não responde (ORD-03)", async () => {
    registrarPedido.mockReturnValue(new Promise(() => {}));
    const result = setupCheckout();
    vi.useFakeTimers();

    act(() => {
      void result.current.handleCheckout();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2499);
    });
    expect(tab.location.href).toBe("");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(tab.location.href).toContain("https://wa.me/5511999990000?text=");
  });

  it("navega na aba atual quando o pop-up é bloqueado (window.open → null)", async () => {
    vi.stubGlobal("open", vi.fn(() => null));
    const fakeLocation = { href: "" };
    Object.defineProperty(window, "location", {
      value: fakeLocation,
      writable: true,
      configurable: true,
    });
    const result = setupCheckout();

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(fakeLocation.href).toContain("https://wa.me/5511999990000?text=");
  });

  it("não grava nem abre nada quando a loja não tem WhatsApp", async () => {
    const result = setupCheckout({ ...baseStore, whatsapp: "" });

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(registrarPedido).not.toHaveBeenCalled();
    expect(openMock()).not.toHaveBeenCalled();
    expect(result.current.toast).toBe("Esta loja ainda não configurou o WhatsApp.");
  });
});

describe("useCatalogo — clientOrderId por conteúdo da sacola (ORD-05)", () => {
  let tab: FakeTab;

  beforeEach(() => {
    registrarPedido.mockReset();
    registrarPedido.mockResolvedValue({ ok: true });
    tab = newTab();
    vi.stubGlobal("open", vi.fn(() => tab));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function checkout(result: { current: ReturnType<typeof useCatalogo> }) {
    await act(async () => {
      await result.current.handleCheckout();
    });
  }

  it("mantém o mesmo clientOrderId em dois envios da mesma sacola", async () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, null, null, 1));

    await checkout(result);
    await checkout(result);

    expect(capturePayload(0).clientOrderId).toBe(capturePayload(1).clientOrderId);
  });

  it("reenviar a mesma sacola repete o mesmo código do pedido (ORD-32.2)", async () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, null, null, 1));

    await checkout(result);
    await checkout(result);

    expect(capturePayload(1).code).toBe(capturePayload(0).code);
  });

  it("gera um novo clientOrderId depois de mudar a quantidade de um item", async () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, null, null, 1));

    await checkout(result);
    act(() => result.current.handleQty(result.current.cart[0].key, 3));
    await checkout(result);

    expect(capturePayload(1).clientOrderId).not.toBe(capturePayload(0).clientOrderId);
    expect(deriveOrderCode(capturePayload(1).clientOrderId as string)).not.toBe(
      deriveOrderCode(capturePayload(0).clientOrderId as string)
    );
  });

  it("gera um novo clientOrderId depois de adicionar outro item", async () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA, productB] })
    );
    act(() => result.current.handleAdd(productA, null, null, 1));

    await checkout(result);
    act(() => result.current.handleAdd(productB, null, null, 1));
    await checkout(result);

    expect(capturePayload(1).clientOrderId).not.toBe(capturePayload(0).clientOrderId);
  });

  it("gera um novo clientOrderId depois de remover um item", async () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA, productB] })
    );
    act(() => result.current.handleAdd(productA, null, null, 1));
    act(() => result.current.handleAdd(productB, null, null, 1));

    await checkout(result);
    act(() => result.current.handleRemove(result.current.cart[1].key));
    await checkout(result);

    expect(capturePayload(1).clientOrderId).not.toBe(capturePayload(0).clientOrderId);
  });
});

describe("useCatalogo — telemetria do catálogo (ANL-01..05, ANL-07)", () => {
  let tab: FakeTab;

  beforeEach(() => {
    registrarPedido.mockReset();
    registrarPedido.mockResolvedValue({ ok: true });
    tab = newTab();
    vi.stubGlobal("open", vi.fn(() => tab));
  });

  const originalLocation = Object.getOwnPropertyDescriptor(window, "location");

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    if (originalLocation) Object.defineProperty(window, "location", originalLocation);
  });

  it("registra uma catalog_visit na montagem quando shouldTrackVisit libera (ANL-01)", () => {
    renderHook(() => useCatalogo({ store: baseStore, products: [productA] }));

    expect(shouldTrackVisit).toHaveBeenCalledWith("ateliemira");
    expect(eventsOf("catalog_visit")).toEqual([["ateliemira", "catalog_visit"]]);
  });

  it("não registra catalog_visit quando a sessão já visitou este slug (ANL-02)", () => {
    shouldTrackVisit.mockReturnValue(false);

    renderHook(() => useCatalogo({ store: baseStore, products: [productA] }));

    expect(eventsOf("catalog_visit")).toHaveLength(0);
  });

  it("não registra catalog_visit de novo ao remontar na mesma sessão (ANL-02)", () => {
    const primeira = renderHook(() => useCatalogo({ store: baseStore, products: [productA] }));
    expect(eventsOf("catalog_visit")).toHaveLength(1);
    primeira.unmount();

    // Remount = recarga da página: o dedup real vive no sessionStorage, e é ele
    // que shouldTrackVisit passa a negar.
    shouldTrackVisit.mockReturnValue(false);
    renderHook(() => useCatalogo({ store: baseStore, products: [productA] }));

    expect(eventsOf("catalog_visit")).toHaveLength(1);
  });

  it("registra product_view com o id do produto ao abrir o detalhe (ANL-03)", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );

    act(() => result.current.handleOpenProduct(productA));

    expect(eventsOf("product_view")).toEqual([["ateliemira", "product_view", "p1"]]);
    expect(result.current.openProduct).toBe(productA);
  });

  it("registra add_to_bag com o id do produto adicionado (ANL-04)", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );

    act(() => result.current.handleAdd(productA, "M", "Areia", 2));

    expect(eventsOf("add_to_bag")).toEqual([["ateliemira", "add_to_bag", "p1"]]);
    expect(result.current.cart).toHaveLength(1);
  });

  it("registra buy_click uma vez no checkout válido, sem product_id (ANL-05)", async () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(eventsOf("buy_click")).toEqual([["ateliemira", "buy_click"]]);
  });

  it("loja sem hasAnalytics não dispara evento nenhum no fluxo completo (APO-14)", async () => {
    const semAnalytics = { ...baseStore, hasAnalytics: false };
    const { result } = renderHook(() =>
      useCatalogo({ store: semAnalytics, products: [productA] })
    );

    act(() => result.current.handleOpenProduct(productA));
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));
    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("loja sem hasAnalytics ainda abre o WhatsApp e registra o pedido (APO-15)", async () => {
    const semAnalytics = { ...baseStore, hasAnalytics: false };
    const { result } = renderHook(() =>
      useCatalogo({ store: semAnalytics, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(tab.location.href).toContain("wa.me");
    expect(registrarPedido).toHaveBeenCalledTimes(1);
  });

  it("não registra buy_click quando a loja não tem WhatsApp configurado", async () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, whatsapp: "" }, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(eventsOf("buy_click")).toHaveLength(0);
  });

  it("registra buy_click mesmo quando registrarPedido falha (edge da spec)", async () => {
    registrarPedido.mockRejectedValue(new Error("banco fora"));
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(eventsOf("buy_click")).toEqual([["ateliemira", "buy_click"]]);
    expect(tab.location.href).toContain("https://wa.me/");
  });

  it("registra buy_click mesmo quando registrarPedido estoura o timeout", async () => {
    vi.useFakeTimers();
    registrarPedido.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.handleCheckout();
    });
    expect(eventsOf("buy_click")).toEqual([["ateliemira", "buy_click"]]);

    await act(async () => {
      vi.advanceTimersByTime(ORDER_CAPTURE_TIMEOUT_MS);
      await pending;
    });

    expect(tab.location.href).toContain("https://wa.me/");
  });

  it("abre o WhatsApp normalmente quando trackEvent lança no checkout (ANL-07)", async () => {
    // A falha é injetada só no buy_click: é o disparo que fica no caminho crítico
    // da venda, e é dele que a AC fala. (O trackEvent real nunca lança — engole
    // tudo internamente —, o que é verificado em analytics-client.test.ts.)
    trackEvent.mockImplementation((_slug: string, eventType: string) => {
      if (eventType === "buy_click") throw new Error("telemetria quebrada");
    });
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(tab.location.href).toContain("https://wa.me/5511999990000");
    expect(registrarPedido).toHaveBeenCalledTimes(1);
  });

  it("renderiza o catálogo normalmente quando trackEvent lança na montagem (ANL-07)", () => {
    trackEvent.mockImplementation(() => {
      throw new Error("telemetria quebrada");
    });

    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );

    expect(result.current.visibleProducts).toHaveLength(1);
    expect(result.current.canCheckout).toBe(false);
  });

  it("adiciona à sacola normalmente quando trackEvent lança (ANL-07)", () => {
    trackEvent.mockImplementation(() => {
      throw new Error("telemetria quebrada");
    });
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );

    act(() => result.current.handleAdd(productA, "M", "Areia", 2));

    expect(result.current.cart).toHaveLength(1);
    expect(result.current.bagOpen).toBe(true);
  });

  it("dispara buy_click antes de abrir a aba do WhatsApp (fora do Promise.race)", async () => {
    const ordem: string[] = [];
    trackEvent.mockImplementation((_slug: string, eventType: string) => {
      ordem.push(`track:${eventType}`);
    });
    vi.stubGlobal(
      "open",
      vi.fn(() => {
        ordem.push("window.open");
        return tab;
      })
    );
    registrarPedido.mockImplementation(() => {
      ordem.push("registrarPedido");
      return Promise.resolve({ ok: true });
    });
    const { result } = renderHook(() =>
      useCatalogo({ store: baseStore, products: [productA] })
    );
    act(() => result.current.handleAdd(productA, "M", "Areia", 2));
    act(() => result.current.setCustomerName("Ana"));

    await act(async () => {
      await result.current.handleCheckout();
    });

    expect(ordem.slice(-3)).toEqual(["track:buy_click", "window.open", "registrarPedido"]);
  });
});
