"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, MessageCircle, Maximize2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProductImageLightbox } from "@/components/catalogo/ProductImageLightbox";
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
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const pointerStartX = useRef<number | null>(null);

  const rawImages = product.images ?? [];
  const images = rawImages.length > 0 ? rawImages : [product.image];

  const needsSize = product.sizes.length > 0;
  const needsColor = product.colors.length > 0;
  const missingSize = needsSize && !selectedSize;
  const missingColor = needsColor && !selectedColor;
  const canAdd = !missingSize && !missingColor;

  const addLabel =
    missingSize && missingColor
      ? "Selecione tamanho e cor"
      : missingSize
      ? "Selecione um tamanho"
      : missingColor
      ? "Selecione uma cor"
      : "Adicionar à sacola";

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartX.current = e.clientX;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    setDragOffset(e.clientX - pointerStartX.current);
  };

  const endDrag = (delta: number) => {
    if (delta < -50 && currentIndex < images.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (delta > 50 && currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
    pointerStartX.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    const delta = e.clientX - pointerStartX.current;
    if (Math.abs(delta) < 8) {
      setLightboxOpen(true);
    }
    endDrag(delta);
  };

  const handlePointerCancel = () => {
    if (pointerStartX.current === null) return;
    endDrag(0);
  };

  return (
    <div className="h-full relative flex flex-col md:flex-row overflow-y-auto no-scrollbar md:overflow-hidden">
      <button
        onClick={onBack}
        aria-label="Voltar"
        className="fixed md:absolute top-3.5 left-3.5 z-10 w-10 h-10 rounded-full flex items-center justify-center text-obsidian"
        style={{
          background: "rgba(249,249,247,0.9)",
          backdropFilter: "blur(4px)",
        }}
      >
        <ChevronLeft size={20} />
      </button>

      <div
        className="relative w-full h-[58vh] shrink-0 md:h-full md:w-[54%] bg-linen overflow-hidden select-none"
        style={{ touchAction: "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="flex h-full"
          style={{
            width: `${images.length * 100}%`,
            transform: `translateX(calc(-${currentIndex * (100 / images.length)}% + ${dragOffset}px))`,
            transition: isDragging ? "none" : "transform 300ms ease-out",
          }}
        >
          {images.map((src, i) => (
            <div
              key={i}
              className="relative h-full flex-shrink-0"
              style={{ width: `${100 / images.length}%` }}
            >
              <Image
                src={src}
                alt={`${product.name} ${i + 1}`}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-contain"
                priority={i === 0}
                draggable={false}
              />
            </div>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <div className="absolute top-3.5 right-3.5 px-2.5 h-6 rounded-full flex items-center justify-center font-body font-medium text-[11px] text-white bg-black/40 backdrop-blur-sm pointer-events-none">
              {currentIndex + 1}/{images.length}
            </div>

            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <div className="flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-black/25 backdrop-blur-sm">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setCurrentIndex(i)}
                    aria-label={`Foto ${i + 1}`}
                    className="rounded-full transition-all duration-200"
                    style={{
                      height: "6px",
                      width: i === currentIndex ? "16px" : "6px",
                      background:
                        i === currentIndex
                          ? "rgba(255,255,255,1)"
                          : "rgba(255,255,255,0.6)",
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => setLightboxOpen(true)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Ver foto em tamanho maior"
          className="absolute bottom-3 right-3.5 w-8 h-8 rounded-full flex items-center justify-center text-white bg-black/25 backdrop-blur-sm"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {lightboxOpen && (
        <ProductImageLightbox
          images={images}
          productName={product.name}
          currentIndex={currentIndex}
          onIndexChange={setCurrentIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 md:h-full md:min-h-0">
        <div className="md:flex-1 md:overflow-y-auto md:min-h-0 px-4 py-5 md:px-6 md:py-6 flex flex-col gap-[18px]">
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
                Cor
                {selectedColor && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="text-obsidian font-medium normal-case tracking-normal text-[12px]">
                      {selectedColor}
                    </span>
                  </>
                )}
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

        <div className="sticky bottom-0 md:static flex-shrink-0 p-4 bg-ivory border-t border-sand/50">
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
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
