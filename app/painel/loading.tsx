function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function StatCardSkeleton() {
  return (
    <div className="bg-linen border border-sand/50 rounded-card p-6 flex flex-col gap-3">
      <Sk w="w-12" h="h-9" rounded="rounded-[6px]" />
      <Sk w="w-28" h="h-3.5" />
    </div>
  );
}

function ProductRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-t border-sand/50 first:border-t-0">
      <Sk w="w-12" h="h-12" rounded="rounded-[8px]" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Sk w="w-40" h="h-4" />
        <Sk w="w-20" h="h-3" />
      </div>
      <Sk w="w-12" h="h-5" rounded="rounded-pill" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-content">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Sk w="w-52" h="h-7" />
          <Sk w="w-64" h="h-4" />
        </div>
        <Sk w="w-44" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Sk w="w-20" h="h-3" />
            <Sk w="w-64" h="h-5" />
          </div>
          <div className="flex gap-2.5">
            <Sk w="w-24" h="h-11" rounded="rounded-btn" />
            <Sk w="w-32" h="h-11" rounded="rounded-btn" />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <Sk w="w-36" h="h-5" />
          <Sk w="w-16" h="h-4" />
        </div>
        <div className="bg-white border border-sand/50 rounded-card overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
