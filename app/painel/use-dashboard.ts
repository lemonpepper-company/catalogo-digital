"use client";

import { useState } from "react";
import type { StoreProduct } from "@/lib/types";

export function useDashboard(products: StoreProduct[], catalogUrl: string) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(catalogUrl).catch(() => {});
    setCopied(true);
    flash("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const activeProducts = products.filter((p) => p.isActive && p.stock > 0);
  const soldOutProducts = products.filter((p) => p.stock === 0);
  const recent = products.slice(0, 4);

  return {
    copied,
    toast,
    handleCopy,
    activeProducts,
    soldOutProducts,
    recent,
    total: products.length,
  };
}
