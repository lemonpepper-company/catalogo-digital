"use client";

import { useState } from "react";
import { PRODUCTS, STORE } from "@/lib/data";

export function useDashboard() {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(`https://${STORE.catalogUrl}`)
      .catch(() => {});
    setCopied(true);
    flash("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const activeProducts = PRODUCTS.filter((p) => p.active && !p.soldOut);
  const soldOutProducts = PRODUCTS.filter((p) => p.soldOut || p.stock === 0);
  const recent = PRODUCTS.slice(0, 4);

  return {
    copied,
    toast,
    handleCopy,
    activeProducts,
    soldOutProducts,
    recent,
    store: STORE,
  };
}
