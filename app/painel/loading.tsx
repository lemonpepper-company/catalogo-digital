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

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Sk w="w-52" h="h-7" />
          <Sk w="w-64" h="h-4" />
        </div>
        <Sk w="w-44" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
    </div>
  );
}
