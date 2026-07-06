"use client";

import { useEffect, useRef } from "react";
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
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    openProduct,
    setOpenProduct,
    cart,
    bagOpen,
    setBagOpen,
    toast,
    visibleProducts,
    hasMore,
    loadMore,
    activeProducts,
    bagCount,
    paymentMethods,
    selectedPayment,
    setSelectedPayment,
    deliveryMethods,
    selectedDelivery,
    setSelectedDelivery,
    address,
    setAddress,
    canCheckout,
    checkoutBlockedReason,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  } = useCatalogo({ store, products });

  const sentinelRef = useRef<HTMLDivElement>(null);
  const accentStyle = { "--color-primary": store.accentColor } as React.CSSProperties;

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  if (openProduct) {
    return (
      <div
        className="fixed inset-0 z-20 bg-ivory md:flex md:items-center md:justify-center md:bg-black/50 md:p-6"
        style={accentStyle}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpenProduct(null);
        }}
      >
        <div className="w-full h-full bg-ivory md:h-[88vh] md:max-w-[920px] md:rounded-card md:overflow-hidden md:shadow-2xl">
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
    <div className="min-h-screen bg-ivory relative" style={accentStyle}>
      <div className="sticky top-0 z-10 bg-ivory">
        <StoreHeader
          store={store}
          activeProductCount={activeProducts.length}
          bagCount={bagCount}
          onOpenBag={() => setBagOpen(true)}
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSearch={toggleSearch}
        />

        <div className="bg-ivory flex gap-2 px-4 py-3.5 overflow-x-auto no-scrollbar">
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
      </div>

      {visibleProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="font-display font-medium text-[16px] text-obsidian">
            {searchQuery.trim()
              ? "Nenhuma peça encontrada"
              : "Nenhuma peça disponível no momento"}
          </p>
          <p className="font-body text-[14px] text-graphite">
            {searchQuery.trim()
              ? "Tente buscar por outro nome."
              : "Volte em breve para conferir as novidades."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 px-4 pb-8 pt-1 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={setOpenProduct}
                priority={index < 2}
              />
            ))}
          </div>
          {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
        </>
      )}

      <BagDrawer
        open={bagOpen}
        items={cart}
        canCheckout={canCheckout}
        blockedReason={checkoutBlockedReason}
        paymentMethods={paymentMethods}
        selectedPayment={selectedPayment}
        onSelectPayment={setSelectedPayment}
        deliveryMethods={deliveryMethods}
        selectedDelivery={selectedDelivery}
        onSelectDelivery={setSelectedDelivery}
        address={address}
        onAddressChange={setAddress}
        onClose={() => setBagOpen(false)}
        onQty={handleQty}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />

      {toast && <Toast msg={toast} position="bottom-center" />}
    </div>
  );
}
