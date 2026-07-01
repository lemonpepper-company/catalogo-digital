"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Product } from "@/lib/types";

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
  onAdd: (
    product: Product,
    size: string | null,
    color: string | null,
    qty: number
  ) => void;
}

export function ProductDetail({ product, onBack, onAdd }: ProductDetailProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(
    product.colors[0]?.label ?? null
  );
  const [qty, setQty] = useState(1);

  const needsSize = product.sizes.length > 1;
  const canAdd = !needsSize || !!selectedSize;

  return (
    <div className="h-full relative flex flex-col">
      <button
        onClick={onBack}
        aria-label="Voltar"
        className="absolute top-3.5 left-3.5 z-10 w-10 h-10 rounded-full flex items-center justify-center text-obsidian"
        style={{
          background: "rgba(249,249,247,0.9)",
          backdropFilter: "blur(4px)",
        }}
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <div className="relative w-full bg-linen" style={{ aspectRatio: "4/5" }}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 384px, 100vw"
            className="object-cover"
            priority
          />
        </div>

        <div className="px-4 py-5 flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1.5">
            {product.isNew && (
              <div>
                <Badge tone="new">Novo</Badge>
              </div>
            )}
            <h1 className="font-display font-semibold text-[22px] text-obsidian leading-snug">
              {product.name}
            </h1>
            <div className="font-body font-medium text-[20px] text-obsidian">
              {product.price}
            </div>
          </div>

          {product.sizes.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                Tamanho
              </span>
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map((size) => {
                  const isSold = product.soldSizes.includes(size);
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      disabled={isSold}
                      onClick={() => !isSold && setSelectedSize(size)}
                      className={[
                        "h-[38px] px-4 rounded-pill font-body font-medium text-[14px] transition-all duration-200",
                        isSold
                          ? "text-inactive line-through cursor-not-allowed border border-sand"
                          : isSelected
                          ? "text-white border-[1.5px]"
                          : "border border-sand text-obsidian hover:bg-surface-hover",
                      ].join(" ")}
                      style={
                        isSelected && !isSold
                          ? { background: "var(--color-primary)", borderColor: "var(--color-primary)" }
                          : undefined
                      }
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {product.colors.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                Cor ·{" "}
                <span className="text-obsidian font-medium normal-case tracking-normal text-[12px]">
                  {selectedColor}
                </span>
              </span>
              <div className="flex gap-2.5">
                {product.colors.map((c) => {
                  const isSelected = selectedColor === c.label;
                  return (
                    <button
                      key={c.label}
                      onClick={() => setSelectedColor(c.label)}
                      aria-label={c.label}
                      title={c.label}
                      className="w-9 h-9 rounded-full transition-all duration-200"
                      style={{
                        background: c.hex,
                        border: isSelected
                          ? "2px solid var(--color-primary)"
                          : "1px solid var(--color-border)",
                        outline: isSelected ? "2px solid var(--color-bg)" : "none",
                        outlineOffset: isSelected ? "-4px" : "0",
                        boxSizing: "border-box",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Quantidade
            </span>
            <div className="inline-flex items-center bg-linen border border-sand rounded-input">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Diminuir"
                className={`w-11 h-11 flex items-center justify-center text-xl transition-colors ${qty <= 1 ? "text-inactive cursor-not-allowed" : "text-obsidian hover:bg-surface-hover"}`}
                disabled={qty <= 1}
              >
                −
              </button>
              <span className="min-w-[40px] text-center font-display font-medium text-[15px] text-obsidian">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(9, q + 1))}
                aria-label="Aumentar"
                className={`w-11 h-11 flex items-center justify-center text-xl transition-colors ${qty >= 9 ? "text-inactive cursor-not-allowed" : "text-obsidian hover:bg-surface-hover"}`}
                disabled={qty >= 9}
              >
                +
              </button>
            </div>
          </div>

          <div className="border-t border-sand/50 pt-[18px] flex flex-col gap-2.5">
            <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Descrição
            </span>
            <p className="font-body text-[14px] leading-relaxed text-graphite">
              {product.desc}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 p-4 bg-ivory border-t border-sand/50">
        <button
          onClick={() => canAdd && onAdd(product, selectedSize, selectedColor, qty)}
          disabled={!canAdd}
          className={[
            "w-full h-[52px] rounded-btn flex items-center justify-center gap-2.5",
            "font-display font-medium text-[16px] transition-all duration-200",
            canAdd
              ? "bg-gold text-white hover:bg-gold-hover"
              : "bg-linen text-inactive cursor-not-allowed",
          ].join(" ")}
        >
          <MessageCircle size={18} />
          {canAdd ? "Adicionar à sacola" : "Selecione um tamanho"}
        </button>
      </div>
    </div>
  );
}
