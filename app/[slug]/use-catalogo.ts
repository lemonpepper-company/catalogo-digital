"use client";

import { useState, useCallback, useEffect } from "react";
import { renderWhatsAppMessage, normalizeWhatsapp } from "@/lib/utils";
import { filterCatalog } from "@/lib/catalog";
import type { CartItem, Product, Store } from "@/lib/types";

export const CATALOG_BATCH_SIZE = 24;

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

  const handleAdd = useCallback(
    (product: Product, size: string | null, color: string | null, qty: number) => {
      const key = `${product.id}|${size ?? ""}|${color ?? ""}`;
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
    []
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

  const handleCheckout = useCallback(() => {
    if (!store.whatsapp) {
      flash("Esta loja ainda não configurou o WhatsApp.");
      return;
    }
    const msg = renderWhatsAppMessage(store.messageTemplate, cart);
    flash("Abrindo o WhatsApp…");
    window.open(
      `https://wa.me/${normalizeWhatsapp(store.whatsapp)}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }, [cart, store.whatsapp, store.messageTemplate, flash]);

  return {
    activeCategory,
    setActiveCategory,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    openProduct,
    setOpenProduct,
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
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  };
}
