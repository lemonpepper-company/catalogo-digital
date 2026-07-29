function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function OrderRowSkeleton({ first = false }: { first?: boolean }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderTop: !first ? "0.5px solid var(--color-border)" : "none" }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Sk w="w-32" h="h-4" />
        <Sk w="w-44" h="h-3" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Sk w="w-20" h="h-4" />
        <Sk w="w-16" h="h-[22px]" rounded="rounded-pill" />
      </div>
    </div>
  );
}

export default function PedidosLoading() {
  return (
    <div className="w-full lg:max-w-content flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Sk w="w-28" h="h-7" />
        <Sk w="w-52" h="h-4" />
      </div>

      <div className="bg-white border border-sand/50 rounded-card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <OrderRowSkeleton key={i} first={i === 0} />
        ))}
      </div>
    </div>
  );
}
