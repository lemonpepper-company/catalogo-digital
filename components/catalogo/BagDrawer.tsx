"use client";

import Image from "next/image";
import { X, ShoppingBag, Trash2, MessageCircle } from "lucide-react";
import type { CartItem } from "@/lib/types";
import { formatMoney, parsePrice } from "@/lib/utils";

interface BagDrawerProps {
  open: boolean;
  items: CartItem[];
  canCheckout?: boolean;
  onClose: () => void;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
}

export function BagDrawer({
  open,
  items,
  canCheckout = true,
  onClose,
  onQty,
  onRemove,
  onCheckout,
}: BagDrawerProps) {
  const total = items.reduce(
    (s, it) => s + parsePrice(it.product.price) * it.qty,
    0
  );
  const totalQty = items.reduce((s, it) => s + it.qty, 0);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-obsidian/40 transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        aria-hidden="true"
      />
      <div
        className={`fixed top-0 right-0 bottom-0 w-[88%] max-w-[360px] z-50 bg-ivory flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ borderLeft: "1px solid var(--color-border)" }}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-sand/50">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={20} className="text-obsidian" />
            <span className="font-display font-semibold text-[18px] text-obsidian">
              Sua sacola
            </span>
            {items.length > 0 && (
              <span className="font-body text-[13px] text-graphite">
                {totalQty} {totalQty === 1 ? "item" : "itens"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar sacola"
            className="w-9 h-9 flex items-center justify-center text-obsidian hover:bg-surface-hover rounded-btn transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3.5 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center text-inactive">
              <ShoppingBag size={28} />
            </div>
            <div className="font-display font-medium text-[16px] text-obsidian">
              Sua sacola está vazia
            </div>
            <div className="font-body text-[14px] text-graphite leading-relaxed">
              Adicione peças e finalize o pedido pelo WhatsApp.
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 no-scrollbar">
            {items.map((it) => {
              const unit = parsePrice(it.product.price);
              return (
                <div
                  key={it.key}
                  className="flex gap-3 py-4 border-t border-sand/50 first:border-t-0"
                >
                  <div className="relative w-16 h-20 rounded-[10px] overflow-hidden bg-linen flex-shrink-0">
                    <Image
                      src={it.product.image}
                      alt={it.product.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display font-medium text-[14px] text-obsidian leading-snug">
                        {it.product.name}
                      </span>
                      <button
                        onClick={() => onRemove(it.key)}
                        aria-label="Remover"
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-graphite hover:text-error transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="font-body text-[12px] text-graphite">
                      {[
                        it.size && `Tam ${it.size}`,
                        it.color,
                      ]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · {formatMoney(unit)}/un
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="inline-flex items-center bg-linen border border-sand rounded-input">
                        <button
                          onClick={() => onQty(it.key, it.qty - 1)}
                          aria-label="Diminuir"
                          className="w-8 h-8 flex items-center justify-center text-obsidian text-lg hover:bg-surface-hover transition-colors"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center font-display font-medium text-[14px] text-obsidian">
                          {it.qty}
                        </span>
                        <button
                          onClick={() => onQty(it.key, it.qty + 1)}
                          aria-label="Aumentar"
                          className="w-8 h-8 flex items-center justify-center text-obsidian text-lg hover:bg-surface-hover transition-colors"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-display font-semibold text-[15px] text-obsidian">
                        {formatMoney(unit * it.qty)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <div className="flex-shrink-0 p-4 border-t border-sand/50 flex flex-col gap-3.5">
            <div className="flex items-baseline justify-between">
              <span className="font-body text-[14px] text-graphite">Total</span>
              <span className="font-display font-semibold text-[24px] text-obsidian">
                {formatMoney(total)}
              </span>
            </div>
            {!canCheckout && (
              <p className="font-body text-[13px] text-graphite text-center">
                Esta loja ainda não configurou o WhatsApp.
              </p>
            )}
            <button
              onClick={onCheckout}
              disabled={!canCheckout}
              className={[
                "w-full h-[52px] rounded-btn font-display font-medium text-[16px] flex items-center justify-center gap-2.5 transition-colors",
                canCheckout
                  ? "bg-gold text-white hover:bg-gold-hover"
                  : "bg-linen text-inactive cursor-not-allowed",
              ].join(" ")}
            >
              <MessageCircle size={18} />
              Enviar pedido via WhatsApp →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
