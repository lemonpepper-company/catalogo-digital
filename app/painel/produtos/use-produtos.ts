"use client";

import { useState, useTransition } from "react";
import {
  toggleProductActive,
  deleteProduct,
} from "@/app/actions/produtos";
import type { StoreProduct, ToastState } from "@/lib/types";

export function useProdutos(products: StoreProduct[], maxProducts: number) {
  const [confirm, setConfirm] = useState<StoreProduct | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const active = products.filter((p) => p.isActive && p.stock > 0).length;
  const soldOut = products.filter((p) => p.stock === 0).length;
  const inactive = products.filter((p) => !p.isActive).length;
  const limitReached = products.length >= maxProducts;

  const toggleActive = (product: StoreProduct) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", product.id);
      fd.set("isActive", String(!product.isActive));
      const res = await toggleProductActive(null, fd);
      if (res && "error" in res) flash(res.error, "error");
    });
  };

  const removeProduct = (id: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteProduct(null, fd);
      if (res && "error" in res) flash(res.error, "error");
      else flash("Produto excluído", "error");
      setConfirm(null);
    });
  };

  return {
    products,
    confirm,
    setConfirm,
    toast,
    active,
    soldOut,
    inactive,
    limitReached,
    isPending,
    toggleActive,
    removeProduct,
  };
}
