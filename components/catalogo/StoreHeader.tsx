"use client";

import { Search, ShoppingBag, X } from "lucide-react";
import type { Store } from "@/lib/types";

interface StoreHeaderProps {
  store: Store;
  activeProductCount: number;
  bagCount: number;
  onOpenBag: () => void;
  searchOpen: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onToggleSearch: () => void;
}

export function StoreHeader({
  store,
  activeProductCount,
  bagCount,
  onOpenBag,
  searchOpen,
  searchQuery,
  onSearchChange,
  onToggleSearch,
}: StoreHeaderProps) {
  return (
    <header className="bg-ivory border-b border-sand/50 px-4 py-[14px] flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.logoUrl}
            alt={store.name}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full text-white flex items-center justify-center font-display font-semibold text-[16px] flex-shrink-0" style={{ background: "var(--color-primary)" }}>
            {store.monogram}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-[18px] text-obsidian leading-tight truncate">
            {store.name}
          </div>
          <div className="font-body text-[12px] text-graphite">
            {activeProductCount} produtos ativos
          </div>
        </div>
        <button
          onClick={onToggleSearch}
          aria-label={searchOpen ? "Fechar busca" : "Buscar"}
          aria-expanded={searchOpen}
          className={`w-10 h-10 border rounded-btn flex items-center justify-center transition-colors ${
            searchOpen
              ? "border-transparent text-white"
              : "border-sand/50 text-obsidian hover:bg-surface-hover"
          }`}
          style={searchOpen ? { background: "var(--color-primary)" } : undefined}
        >
          {searchOpen ? <X size={18} /> : <Search size={18} />}
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
      </div>

      {searchOpen && (
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite pointer-events-none"
          />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar produtos pelo nome…"
            aria-label="Buscar produtos pelo nome"
            className="w-full h-10 pl-9 pr-3 border border-sand/50 rounded-btn bg-white font-body text-[14px] text-obsidian placeholder:text-graphite focus:outline-none focus:border-graphite transition-colors"
          />
        </div>
      )}
    </header>
  );
}
