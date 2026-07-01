"use client";

import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { ProductDetail } from "@/components/catalogo/ProductDetail";
import { BagDrawer } from "@/components/catalogo/BagDrawer";
import type { Product, Store } from "@/lib/types";
import { useCatalogo } from "./use-catalogo";

interface CatalogoClientProps {
  store: Store;
  products: Product[];
}

export function CatalogoClient({ store, products }: CatalogoClientProps) {
  const {
    activeCategory,
    setActiveCategory,
    openProduct,
    setOpenProduct,
    cart,
    bagOpen,
    setBagOpen,
    toast,
    filteredProducts,
    activeProducts,
    bagCount,
    hasWhatsapp,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  } = useCatalogo({ store, products });

  if (openProduct) {
    return (
      <div className="fixed inset-0 bg-ivory z-20 md:flex md:justify-center">
        <div className="w-full h-full md:max-w-sm">
          <ProductDetail
            product={openProduct}
            onBack={() => setOpenProduct(null)}
            onAdd={handleAdd}
          />
          {toast && <Toast msg={toast} position="bottom-center" />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory relative">
      <StoreHeader
        store={store}
        activeProductCount={activeProducts.length}
        bagCount={bagCount}
        onOpenBag={() => setBagOpen(true)}
      />

      <div className="sticky top-[69px] z-10 bg-ivory flex gap-2 px-4 py-3.5 overflow-x-auto no-scrollbar">
        {store.categories.map((cat) => (
          <Pill
            key={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Pill>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="font-display font-medium text-[16px] text-obsidian">
            Nenhuma peça disponível no momento
          </p>
          <p className="font-body text-[14px] text-graphite">
            Volte em breve para conferir as novidades.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 px-4 pb-8 pt-1 sm:grid-cols-3 lg:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpen={setOpenProduct}
            />
          ))}
        </div>
      )}

      <BagDrawer
        open={bagOpen}
        items={cart}
        canCheckout={hasWhatsapp}
        onClose={() => setBagOpen(false)}
        onQty={handleQty}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />

      {toast && <Toast msg={toast} position="bottom-center" />}
    </div>
  );
}
