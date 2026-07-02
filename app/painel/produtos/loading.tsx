function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function ProductRowSkeleton({ first = false }: { first?: boolean }) {
  return (
    <div
      style={{ borderTop: !first ? "0.5px solid var(--color-border)" : "none" }}
    >
      <div className="lg:hidden flex items-center gap-4 px-5 py-4">
        <Sk w="w-[52px]" h="h-16" rounded="rounded-[8px]" />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <Sk w="w-32" h="h-4" />
          <Sk w="w-20" h="h-3" />
        </div>
        <Sk w="w-9" h="h-9" rounded="rounded-btn" />
      </div>
      <div className="hidden lg:flex items-center gap-4 px-5 py-3.5">
        <Sk w="w-12" h="h-12" rounded="rounded-[8px]" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Sk w="w-48" h="h-4" />
          <Sk w="w-24" h="h-3" />
        </div>
        <Sk w="w-14" h="h-5" rounded="rounded-pill" />
        <Sk w="w-10" h="h-6" rounded="rounded-btn" />
        <Sk w="w-9" h="h-9" rounded="rounded-btn" />
      </div>
    </div>
  );
}

export default function ProdutosLoading() {
  return (
    <div className="max-w-content flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Sk w="w-28" h="h-7" />
          <Sk w="w-56" h="h-4" />
        </div>
        <Sk w="w-40" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="bg-white border border-sand/50 rounded-card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductRowSkeleton key={i} first={i === 0} />
        ))}
      </div>
    </div>
  );
}
