"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { renderWhatsAppMessage, normalizeWhatsapp } from "@/lib/utils";
import { filterCatalog } from "@/lib/catalog";
import {
  deriveOrderCode,
  isValidCustomerName,
  newClientOrderId,
  sanitizeCustomerName,
} from "@/lib/orders";
import { registrarPedido } from "@/app/actions/pedidos";
import { shouldTrackVisit, trackEvent } from "@/lib/analytics-client";
import type { CartItem, Product, Store } from "@/lib/types";

export const CATALOG_BATCH_SIZE = 24;
export const ORDER_CAPTURE_TIMEOUT_MS = 2500;

function cartSignature(cart: CartItem[]): string {
  return cart.map((it) => `${it.key}x${it.qty}`).join("|");
}

// SPEC_DEVIATION: o design deposita a garantia de "nunca bloqueia" apenas dentro
// de trackEvent (que já engole tudo). Aqui ela é reforçada no call site.
// Reason: ANL-07 exige que a navegação e o checkout prossigam quando o registro
// falha — inclusive de forma síncrona. Sem esta borda, um throw síncrono no
// buy_click escapa de handleCheckout (o disparo fica FORA do try/Promise.race,
// por exigência da própria AC) e a aba do WhatsApp nunca recebe a URL; no efeito
// de montagem, derrubaria o render do catálogo. Duas linhas no ponto mais caro
// do produto — a venda.
function track(enabled: boolean, ...args: Parameters<typeof trackEvent>): void {
  // Loja sem o recurso não gasta round-trip com uma Server Action que vai
  // recusar de qualquer jeito (APO-14). É só otimização: o gate autoritativo
  // vive em `registrarEvento`, que não confia no cliente (APO-15).
  if (!enabled) return;

  try {
    trackEvent(...args);
  } catch {
    // Telemetria jamais interrompe navegação ou venda (ANL-07).
  }
}

interface UseCatalogoArgs {
  store: Store;
  products: Product[];
}

export function useCatalogo({ store, products }: UseCatalogoArgs) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(CATALOG_BATCH_SIZE);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Chave de idempotência por conteúdo da sacola: reenviar a mesma sacola
  // reaproveita o id, qualquer mudança gera um novo (ORD-05). Fica em ref para
  // não gerar valor aleatório durante o render.
  const orderKeyRef = useRef<{ signature: string; id: string } | null>(null);

  const clientOrderIdFor = useCallback((signature: string) => {
    const current = orderKeyRef.current;
    if (current && current.signature === signature) return current.id;
    const id = newClientOrderId();
    orderKeyRef.current = { signature, id };
    return id;
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Alterna o campo de busca; ao fechar, limpa o termo (CAT-B06).
  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) setSearchQuery("");
      return !open;
    });
  }, []);

  // Uma visita por slug por sessão do navegador (ANL-01/02). O dedup vive no
  // sessionStorage, então recarregar a página não conta de novo.
  useEffect(() => {
    if (shouldTrackVisit(store.slug)) {
      track(store.hasAnalytics, store.slug, "catalog_visit");
    }
  }, [store.slug, store.hasAnalytics]);

  const filteredProducts = filterCatalog(products, activeCategory, searchQuery);

  // Volta pro lote inicial sempre que o filtro muda — senão o scroll fica
  // com um número de itens visíveis que não corresponde ao filtro atual.
  useEffect(() => {
    setVisibleCount(CATALOG_BATCH_SIZE);
  }, [activeCategory, searchQuery]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + CATALOG_BATCH_SIZE);
  }, []);

  const bagCount = cart.reduce((s, it) => s + it.qty, 0);
  const hasWhatsapp = !!store.whatsapp;
  const paymentMethods = store.paymentMethods ?? [];
  const deliveryMethods = store.deliveryMethods ?? [];
  const paymentComplete = paymentMethods.length === 0 || !!selectedPayment;
  const deliveryComplete =
    deliveryMethods.length === 0 ||
    (!!selectedDelivery && (selectedDelivery !== "entrega" || address.trim() !== ""));
  const nameComplete = isValidCustomerName(customerName);
  const canCheckout = hasWhatsapp && nameComplete && paymentComplete && deliveryComplete;
  // Um aviso por vez. O nome vem primeiro porque é o único bloqueio que a AC
  // exige incondicionalmente quando o campo está vazio (ORD-31.3).
  const checkoutBlockedReason =
    !hasWhatsapp || canCheckout
      ? null
      : !nameComplete
        ? "Informe seu nome para continuar"
        : "Selecione forma de pagamento e entrega para continuar.";

  // Abrir o detalhe do produto é o gatilho de product_view (ANL-03). Fica aqui, e
  // não no componente, para que o contrato de props do catálogo não mude (AD-006).
  const handleOpenProduct = useCallback(
    (product: Product) => {
      setOpenProduct(product);
      track(store.hasAnalytics, store.slug, "product_view", product.id);
    },
    [store.slug, store.hasAnalytics]
  );

  const handleAdd = useCallback(
    (product: Product, size: string | null, color: string | null, qty: number) => {
      const key = `${product.id}|${size ?? ""}|${color ?? ""}`;
      track(store.hasAnalytics, store.slug, "add_to_bag", product.id);
      setCart((prev) => {
        const found = prev.find((it) => it.key === key);
        if (found) {
          return prev.map((it) =>
            it.key === key ? { ...it, qty: Math.min(99, it.qty + qty) } : it
          );
        }
        return [...prev, { key, product, size, color, qty }];
      });
      setOpenProduct(null);
      setBagOpen(true);
    },
    [store.slug, store.hasAnalytics]
  );

  const handleQty = useCallback((key: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((it) => it.key !== key)
        : prev.map((it) => (it.key === key ? { ...it, qty } : it))
    );
  }, []);

  const handleRemove = useCallback((key: string) => {
    setCart((prev) => prev.filter((it) => it.key !== key));
  }, []);

  const handleCheckout = useCallback(async () => {
    if (!store.whatsapp) {
      flash("Esta loja ainda não configurou o WhatsApp.");
      return;
    }
    // buy_click mede a INTENÇÃO de compra, então dispara aqui: depois do guard de
    // WhatsApp, antes do window.open e fora do Promise.race abaixo (ANL-05/07).
    // Registrar aqui garante o evento mesmo se registrarPedido falhar ou estourar
    // o timeout — o pedido em si vem de `orders`.
    track(store.hasAnalytics, store.slug, "buy_click");
    // Nome e código entram na mensagem antes de qualquer ida ao servidor: o
    // código é derivado do clientOrderId no próprio cliente, então a mensagem
    // continua completa mesmo se a gravação falhar ou estourar o timeout
    // (ORD-32.1, ORD-32.3). O código não vai no payload — o servidor deriva o
    // mesmo valor da mesma função, então nada aqui precisa ser confiado.
    const clientOrderId = clientOrderIdFor(cartSignature(cart));
    const code = deriveOrderCode(clientOrderId);
    const sanitizedName = sanitizeCustomerName(customerName);

    const msg = renderWhatsAppMessage(store.messageTemplate, cart, {
      payment: selectedPayment,
      delivery: selectedDelivery,
      address,
      customerName: sanitizedName,
      code,
    });
    const url = `https://wa.me/${normalizeWhatsapp(store.whatsapp)}?text=${encodeURIComponent(msg)}`;

    // A aba é aberta sincronamente no gesto do clique — é o que escapa do
    // bloqueador de pop-up, já que a URL só é atribuída depois do await (ORD-01).
    const tab = window.open("", "_blank");
    flash("Abrindo o WhatsApp…");

    try {
      await Promise.race([
        registrarPedido({
          slug: store.slug,
          clientOrderId,
          customerName: sanitizedName,
          payment: selectedPayment,
          delivery: selectedDelivery,
          address: address.trim() || null,
          items: cart.map((it) => ({
            productId: it.product.id,
            size: it.size,
            color: it.color,
            qty: it.qty,
          })),
        }),
        new Promise<void>((resolve) => setTimeout(resolve, ORDER_CAPTURE_TIMEOUT_MS)),
      ]);
    } catch {
      // A captura nunca bloqueia a venda: falha fica só no log do servidor e
      // nada é exibido ao cliente (ORD-03).
    }

    if (tab) tab.location.href = url;
    else window.location.href = url;
  }, [
    cart,
    store.whatsapp,
    store.messageTemplate,
    store.slug,
    store.hasAnalytics,
    selectedPayment,
    selectedDelivery,
    address,
    customerName,
    clientOrderIdFor,
    flash,
  ]);

  return {
    activeCategory,
    setActiveCategory,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    openProduct,
    setOpenProduct,
    handleOpenProduct,
    cart,
    bagOpen,
    setBagOpen,
    toast,
    visibleProducts,
    hasMore,
    loadMore,
    activeProducts: products,
    bagCount,
    hasWhatsapp,
    paymentMethods,
    selectedPayment,
    setSelectedPayment,
    deliveryMethods,
    selectedDelivery,
    setSelectedDelivery,
    address,
    setAddress,
    customerName,
    setCustomerName,
    canCheckout,
    checkoutBlockedReason,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  };
}
