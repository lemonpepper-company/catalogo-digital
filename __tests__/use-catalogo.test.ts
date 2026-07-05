import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalogo } from "@/app/[slug]/use-catalogo";
import type { Product, Store } from "@/lib/types";

const baseStore: Store = {
  name: "Ateliê Mira",
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos"],
  description: "",
  accentColor: "#C9A96E",
  catalogUrl: "vtrinedigital.com.br/ateliemira",
};

const products: Product[] = [];

describe("useCatalogo — canCheckout com pagamento e entrega (novo)", () => {
  it("fica false quando a loja não tem whatsapp, mesmo sem pagamento/entrega configurados", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, whatsapp: "" }, products })
    );
    expect(result.current.canCheckout).toBe(false);
  });

  it("fica true com whatsapp e sem pagamento/entrega configurados (comportamento atual preservado)", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    expect(result.current.canCheckout).toBe(true);
  });

  it("fica false quando há formas de pagamento configuradas e nenhuma selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, paymentMethods: ["pix", "cartao"] }, products })
    );
    expect(result.current.canCheckout).toBe(false);
  });

  it("fica true após selecionar uma forma de pagamento", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, paymentMethods: ["pix", "cartao"] }, products })
    );
    act(() => result.current.setSelectedPayment("pix"));
    expect(result.current.canCheckout).toBe(true);
  });

  it("exige endereço quando 'entrega' é selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, deliveryMethods: ["retirada", "entrega"] }, products })
    );
    act(() => result.current.setSelectedDelivery("entrega"));
    expect(result.current.canCheckout).toBe(false);
    act(() => result.current.setAddress("Rua X, 123"));
    expect(result.current.canCheckout).toBe(true);
  });

  it("não exige endereço quando 'retirada' é selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, deliveryMethods: ["retirada", "entrega"] }, products })
    );
    act(() => result.current.setSelectedDelivery("retirada"));
    expect(result.current.canCheckout).toBe(true);
  });
});

describe("useCatalogo — handleCheckout com pagamento e entrega (novo)", () => {
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
  };

  beforeEach(() => {
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inclui pagamento e entrega selecionados na mensagem enviada", () => {
    const store: Store = {
      ...baseStore,
      paymentMethods: ["pix"],
      deliveryMethods: ["retirada"],
    };
    const { result } = renderHook(() => useCatalogo({ store, products: [productA] }));
    act(() => result.current.handleAdd(productA, null, null, 1));
    act(() => result.current.setSelectedPayment("pix"));
    act(() => result.current.setSelectedDelivery("retirada"));
    act(() => result.current.handleCheckout());

    const openMock = window.open as ReturnType<typeof vi.fn>;
    const [url] = openMock.mock.calls[0];
    const message = decodeURIComponent(url.split("?text=")[1]);
    expect(message).toContain("Forma de pagamento: Pix");
    expect(message).toContain("Entrega: Retirar no local");
  });
});
