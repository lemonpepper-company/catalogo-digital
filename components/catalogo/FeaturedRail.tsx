"use client";

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
      <div className="flex gap-4 px-4 pb-2 overflow-x-auto no-scrollbar">
        {featured.map((product) => (
          <div key={product.id} className="w-[144px] flex-shrink-0">
            <ProductCard product={product} onOpen={onOpen} priority={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
