"use client";

import { ChevronRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/catalogo/ProductCard";

interface FeaturedRailProps {
  products: Product[];
  onOpen: (product: Product) => void;
}

export function FeaturedRail({ products, onOpen }: FeaturedRailProps) {
  const featured = products.filter((p) => p.isFeatured && p.active);
  if (featured.length === 0) return null;

  return (
    <div className="pt-4 pb-2">
      <h2 className="font-display font-medium text-[16px] text-obsidian px-4 mb-3">
        Destaques
      </h2>
      <div className="relative">
        <div className="flex gap-4 px-4 pb-2 overflow-x-auto no-scrollbar">
          {featured.map((product) => (
            <div key={product.id} className="w-[160px] flex-shrink-0">
              <ProductCard product={product} onOpen={onOpen} priority={false} />
            </div>
          ))}
        </div>
        {featured.length > 2 && (
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 h-[160px] w-16 flex items-center justify-end pr-2"
          >
            <div className="absolute inset-0 bg-gradient-to-l from-[var(--color-bg)] to-transparent" />
            <div className="relative w-8 h-8 rounded-full bg-white/90 shadow-sm flex items-center justify-center">
              <ChevronRight size={18} className="text-obsidian" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
