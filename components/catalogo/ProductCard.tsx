"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
  priority?: boolean;
}

export function ProductCard({ product, onOpen, priority = false }: ProductCardProps) {
  const isSoldOut = product.soldOut || product.stock === 0;

  return (
    <div
      className="bg-ivory border border-sand/50 rounded-card overflow-hidden"
      onClick={() => !isSoldOut && onOpen(product)}
    >
      <div className="relative aspect-square bg-linen">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover"
          style={{ borderRadius: "16px 16px 0 0" }}
          priority={priority}
        />
        {isSoldOut && (
          <div className="absolute inset-0 bg-white/60 rounded-t-card" />
        )}
        {isSoldOut && (
          <div className="absolute top-2 left-2">
            <Badge tone="soldout">Esgotado</Badge>
          </div>
        )}
        {product.isNew && !isSoldOut && (
          <div className="absolute top-2 left-2">
            <Badge tone="new">Novo</Badge>
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div
          className="font-display font-medium text-[14px] text-obsidian leading-snug"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </div>
        <div className="font-body text-[13px] text-graphite">{product.price}</div>
        <button
          disabled={isSoldOut}
          onClick={(e) => {
            e.stopPropagation();
            if (!isSoldOut) onOpen(product);
          }}
          className={[
            "w-full h-[38px] rounded-btn flex items-center justify-center gap-1.5",
            "font-display font-medium text-[12px] tracking-[0.02em] whitespace-nowrap transition-colors",
            isSoldOut
              ? "bg-linen text-inactive cursor-not-allowed"
              : "bg-gold text-white hover:bg-gold-hover",
          ].join(" ")}
        >
          {isSoldOut ? (
            "Indisponível"
          ) : (
            <>
              <ShoppingBag size={13} />
              Adicionar à sacola
            </>
          )}
        </button>
      </div>
    </div>
  );
}
