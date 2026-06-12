"use client";

import { Search, ShoppingBag } from "lucide-react";
import type { Store } from "@/lib/types";

interface StoreHeaderProps {
  store: Store;
  activeProductCount: number;
  bagCount: number;
  onOpenBag: () => void;
}

export function StoreHeader({
  store,
  activeProductCount,
  bagCount,
  onOpenBag,
}: StoreHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-ivory border-b border-sand/50 px-4 py-[14px] flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-obsidian text-white flex items-center justify-center font-display font-semibold text-[16px] flex-shrink-0">
        {store.monogram}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-[18px] text-obsidian leading-tight truncate">
          {store.name}
        </div>
        <div className="font-body text-[12px] text-graphite">
          {activeProductCount} produtos ativos
        </div>
      </div>
      <button
        aria-label="Buscar"
        className="w-10 h-10 border border-sand/50 rounded-btn flex items-center justify-center text-obsidian hover:bg-surface-hover transition-colors"
      >
        <Search size={18} />
      </button>
      <button
        onClick={onOpenBag}
        aria-label="Abrir sacola"
        className="relative w-10 h-10 border border-sand/50 rounded-btn flex items-center justify-center text-obsidian hover:bg-surface-hover transition-colors"
      >
        <ShoppingBag size={18} />
        {bagCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-gold text-white flex items-center justify-center font-display font-semibold text-[11px] leading-none border-2 border-ivory">
            {bagCount}
          </span>
        )}
      </button>
    </header>
  );
}
