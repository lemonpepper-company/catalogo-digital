"use client";

import { useEffect, useRef, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { StoreBanner } from "@/components/catalogo/StoreBanner";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { ProductDetail } from "@/components/catalogo/ProductDetail";
import { BagDrawer } from "@/components/catalogo/BagDrawer";
import { FeaturedRail } from "@/components/catalogo/FeaturedRail";
import type { Product, Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCatalogo } from "./use-catalogo";

interface CatalogoClientProps {
  store: Store;
  products: Product[];
}

/**
 * Converte um hex ("#F9F9F7" ou "#FFF") para a string de canais RGB
 * espaçados por espaço ("249 249 247") que o tailwind.config.ts espera para
 * compor as cores ivory/linen/sand com o padrão rgb(var(...) / <alpha-value>).
 * Sem isso, uma loja com paleta de fundo customizada teria bg-linen correto
 * mas bg-linen/50 (e demais utilitários com opacidade) quebrados, pois
 * ficariam presos ao valor padrão das variáveis "-rgb".
 */
function hexToRgbChannels(hex: string): string | null {
  const normalized = hex.trim().replace(/^#/, "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
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
    handleOpenProduct,
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
    customerName,
    setCustomerName,
    canCheckout,
    checkoutBlockedReason,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  } = useCatalogo({ store, products });

  const sentinelRef = useRef<HTMLDivElement>(null);
  const bgRgb = hexToRgbChannels(store.theme.backgroundColor);
  const surfaceRgb = hexToRgbChannels(store.theme.surfaceColor);
  const borderRgb = hexToRgbChannels(store.theme.borderColor);
  const themeStyle = {
    "--color-primary": store.accentColor,
    "--color-bg": store.theme.backgroundColor,
    "--color-surface": store.theme.surfaceColor,
    "--color-border": store.theme.borderColor,
    // Mantém as variáveis "-rgb" (canais RGB, usadas pelos utilitários Tailwind
    // ivory/linen/sand com modificador de opacidade, ex. bg-linen/50) em sincronia
    // com a paleta de fundo customizada da loja. Ver hexToRgbChannels() acima e o
    // comentário em tailwind.config.ts.
    ...(bgRgb ? { "--color-bg-rgb": bgRgb } : {}),
    ...(surfaceRgb ? { "--color-surface-rgb": surfaceRgb } : {}),
    ...(borderRgb ? { "--color-border-rgb": borderRgb } : {}),
    "--radius-card": store.theme.cardRadius,
    "--radius-btn": store.theme.btnRadius,
    ...(store.theme.fontDisplayVar !== "--font-sora"
      ? { "--font-sora": `var(${store.theme.fontDisplayVar})` }
      : {}),
    ...(store.theme.fontBodyVar !== "--font-dm-sans"
      ? { "--font-dm-sans": `var(${store.theme.fontBodyVar})` }
      : {}),
    ...(store.theme.secondaryColor ? { "--color-secondary": store.theme.secondaryColor } : {}),
  } as React.CSSProperties;

  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  return (
    <div className="min-h-screen bg-ivory relative" style={themeStyle}>
      <div ref={headerRef} className="sticky top-0 z-20 bg-ivory">
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
      </div>

      <StoreBanner store={store} />

      <div
        className="sticky z-10 bg-ivory flex gap-2 px-4 py-3.5 overflow-x-auto no-scrollbar"
        style={{ top: headerH }}
      >
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

      <FeaturedRail products={products} onOpen={handleOpenProduct} />

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
          <div
            className={cn(
              "grid gap-4 px-4 pb-8 pt-1",
              store.gridDensity === "compacto"
                ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            )}
          >
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={handleOpenProduct}
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
        customerName={customerName}
        onCustomerNameChange={setCustomerName}
        onClose={() => setBagOpen(false)}
        onQty={handleQty}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />

      {toast && <Toast msg={toast} position="bottom-center" />}

      {openProduct && (
        <div
          className="fixed inset-0 z-20 bg-ivory md:flex md:items-center md:justify-center md:bg-black/20 md:backdrop-blur-md md:p-6"
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
          </div>
        </div>
      )}
    </div>
  );
}
