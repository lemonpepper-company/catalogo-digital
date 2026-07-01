"use client";

import { useState, useCallback } from "react";
import { renderWhatsAppMessage, normalizeWhatsapp } from "@/lib/utils";
import type { CartItem, Product, Store } from "@/lib/types";

interface UseCatalogoArgs {
  store: Store;
  products: Product[];
}

export function useCatalogo({ store, products }: UseCatalogoArgs) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const filteredProducts =
    activeCategory === "Todos"
      ? products
      : products.filter((p) => p.category === activeCategory);

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
    openProduct,
    setOpenProduct,
    cart,
    bagOpen,
    setBagOpen,
    toast,
    filteredProducts,
    activeProducts: products,
    bagCount,
    hasWhatsapp,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  };
}
