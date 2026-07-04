"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  toggleProductActive,
  deleteProduct,
} from "@/app/actions/produtos";
import type { StoreProduct, ToastState } from "@/lib/types";

export interface ProductCounts {
  active: number;
  soldOut: number;
  inactive: number;
  total: number;
}

export interface ProductFilters {
  q: string;
  categoria: string;
  status: string;
}

export function useProdutos(
  products: StoreProduct[],
  maxProducts: number,
  counts: ProductCounts,
  page: number,
  filters: ProductFilters
) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<StoreProduct | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const limitReached = counts.total >= maxProducts;

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
      if (res && "error" in res) {
        flash(res.error, "error");
      } else {
        flash("Produto excluído", "error");
        if (products.length === 1 && page > 1) {
          const params = new URLSearchParams();
          params.set("page", String(page - 1));
          if (filters.q) params.set("q", filters.q);
          if (filters.categoria) params.set("categoria", filters.categoria);
          if (filters.status) params.set("status", filters.status);
          router.push(`/painel/produtos?${params.toString()}`);
        }
      }
      setConfirm(null);
    });
  };

  return {
    products,
    confirm,
    setConfirm,
    toast,
    active: counts.active,
    soldOut: counts.soldOut,
    inactive: counts.inactive,
    limitReached,
    isPending,
    toggleActive,
    removeProduct,
  };
}
