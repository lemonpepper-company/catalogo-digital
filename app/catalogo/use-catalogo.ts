"use client";

import { useState, useCallback } from "react";
import { PRODUCTS, STORE } from "@/lib/data";
import { buildWhatsAppMessage } from "@/lib/utils";
import type { CartItem, Product } from "@/lib/types";

export function useCatalogo() {
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
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === activeCategory);

  const activeProducts = PRODUCTS.filter((p) => !p.soldOut);
  const bagCount = cart.reduce((s, it) => s + it.qty, 0);

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
    const msg = buildWhatsAppMessage(cart);
    flash("Abrindo o WhatsApp…");
    window.open(
      `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }, [cart, flash]);

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
    activeProducts,
    bagCount,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  };
}
