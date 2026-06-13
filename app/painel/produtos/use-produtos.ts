"use client";

import { useState } from "react";
import { PRODUCTS as INITIAL_PRODUCTS } from "@/lib/data";
import type { Product, ToastState } from "@/lib/types";

export function useProdutos() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [confirm, setConfirm] = useState<Product | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const active = products.filter((p) => p.active && !p.soldOut).length;
  const soldOut = products.filter((p) => p.soldOut || p.stock === 0).length;
  const inactive = products.filter((p) => !p.active).length;

  const toggleActive = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    flash("Produto excluído", "error");
    setConfirm(null);
  };

  return {
    products,
    confirm,
    setConfirm,
    toast,
    active,
    soldOut,
    inactive,
    toggleActive,
    removeProduct,
  };
}
