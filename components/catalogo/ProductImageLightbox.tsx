"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface ProductImageLightboxProps {
  images: string[];
  productName: string;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function ProductImageLightbox({
  images,
  productName,
  currentIndex,
  onIndexChange,
  onClose,
}: ProductImageLightboxProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartX = useRef<number | null>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

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
      onIndexChange(currentIndex + 1);
    } else if (delta > 50 && currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
    pointerStartX.current = null;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    endDrag(e.clientX - pointerStartX.current);
  };

  const handlePointerCancel = () => {
    if (pointerStartX.current === null) return;
    endDrag(0);
  };

  return (
    <div className="fixed inset-0 z-40 bg-obsidian flex flex-col">
      <button
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-3.5 right-3.5 z-10 w-10 h-10 rounded-full flex items-center justify-center text-white"
        style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
      >
        <X size={20} />
      </button>

      {images.length > 1 && (
        <div className="absolute top-3.5 left-3.5 z-10 px-2.5 h-6 rounded-full flex items-center justify-center font-body font-medium text-[11px] text-white bg-white/15 backdrop-blur-sm pointer-events-none">
          {currentIndex + 1}/{images.length}
        </div>
      )}

      <div
        className="relative flex-1 overflow-hidden select-none"
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
                alt={`${productName} ${i + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <div className="pb-6 pt-2 flex justify-center">
          <div className="flex items-center gap-1.5 px-2.5 h-6 rounded-full bg-white/15 backdrop-blur-sm">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => onIndexChange(i)}
                aria-label={`Foto ${i + 1}`}
                className="rounded-full transition-all duration-200"
                style={{
                  height: "6px",
                  width: i === currentIndex ? "16px" : "6px",
                  background:
                    i === currentIndex
                      ? "rgba(255,255,255,1)"
                      : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
