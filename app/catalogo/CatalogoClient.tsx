"use client";

import { useState, useCallback } from "react";
import { PRODUCTS, STORE } from "@/lib/data";
import { buildWhatsAppMessage } from "@/lib/utils";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { ProductDetail } from "@/components/catalogo/ProductDetail";
import { BagDrawer } from "@/components/catalogo/BagDrawer";
import type { CartItem, Product } from "@/lib/types";

export function CatalogoClient() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const filteredProducts =
    activeCategory === "Todos"
      ? PRODUCTS
      : PRODUCTS.filter((p) => p.category === activeCategory);

  const activeProducts = PRODUCTS.filter((p) => !p.soldOut);
  const bagCount = cart.reduce((s, it) => s + it.qty, 0);

  const handleAdd = useCallback(
    (
      product: Product,
      size: string | null,
      color: string | null,
      qty: number
    ) => {
      const key = `${product.id}|${size ?? ""}|${color ?? ""}`;
      setCart((prev) => {
        const found = prev.find((it) => it.key === key);
        if (found) {
          return prev.map((it) =>
            it.key === key
              ? { ...it, qty: Math.min(99, it.qty + qty) }
              : it
          );
        }
        return [...prev, { key, product, size, color, qty }];
      });
      setOpenProduct(null);
      setBagOpen(true);
    },
    []
  );

  const handleQty = useCallback((key: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((it) => it.key !== key)
        : prev.map((it) => (it.key === key ? { ...it, qty } : it))
    );
  }, []);

  const handleRemove = useCallback((key: string) => {
    setCart((prev) => prev.filter((it) => it.key !== key));
  }, []);

  const handleCheckout = useCallback(() => {
    const msg = buildWhatsAppMessage(cart);
    flash("Abrindo o WhatsApp…");
    window.open(
      `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }, [cart, flash]);

  if (openProduct) {
    return (
      <div className="fixed inset-0 bg-ivory z-20">
        <ProductDetail
          product={openProduct}
          onBack={() => setOpenProduct(null)}
          onAdd={handleAdd}
        />
        {toast && <Toast msg={toast} position="bottom-center" />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory relative">
      <StoreHeader
        store={STORE}
        activeProductCount={activeProducts.length}
        bagCount={bagCount}
        onOpenBag={() => setBagOpen(true)}
      />

      {/* Category pills sticky below header */}
      <div className="sticky top-[69px] z-10 bg-ivory flex gap-2 px-4 py-3.5 overflow-x-auto no-scrollbar">
        {STORE.categories.map((cat) => (
          <Pill
            key={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          >
            {cat.toUpperCase()}
          </Pill>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 px-4 pb-8 pt-1 sm:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onOpen={setOpenProduct}
          />
        ))}
      </div>

      <BagDrawer
        open={bagOpen}
        items={cart}
        onClose={() => setBagOpen(false)}
        onQty={handleQty}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />

      {toast && <Toast msg={toast} position="bottom-center" />}
    </div>
  );
}
