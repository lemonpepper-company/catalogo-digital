function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function CategoryRowSkeleton({ first = false }: { first?: boolean }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-3.5"
      style={{ borderTop: !first ? "0.5px solid var(--color-border)" : "none" }}
    >
      <div className="w-9 h-9 rounded-[8px] bg-linen flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Sk w="w-36" h="h-4" />
        <Sk w="w-16" h="h-3" />
      </div>
      <div className="flex gap-1">
        <Sk w="w-9" h="h-9" rounded="rounded-btn" />
        <Sk w="w-9" h="h-9" rounded="rounded-btn" />
      </div>
    </div>
  );
}

export default function CategoriasLoading() {
  return (
    <div className="max-w-form flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Sk w="w-32" h="h-7" />
          <Sk w="w-64" h="h-4" />
        </div>
        <Sk w="w-40" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="bg-white border border-sand/50 rounded-card overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <CategoryRowSkeleton key={i} first={i === 0} />
        ))}
      </div>
    </div>
  );
}
