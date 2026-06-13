"use client";

import { STORE } from "@/lib/data";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { ProductDetail } from "@/components/catalogo/ProductDetail";
import { BagDrawer } from "@/components/catalogo/BagDrawer";
import { useCatalogo } from "./use-catalogo";

export function CatalogoClient() {
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
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  } = useCatalogo();

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
            {cat}
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
