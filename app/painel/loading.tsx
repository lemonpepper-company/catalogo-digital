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
      <div className="flex flex-col gap-2">
        <Sk w="w-52" h="h-7" />
        <Sk w="w-64" h="h-4" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <Sk w="w-40" h="h-5" />
          <Sk w="w-24" h="h-4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      </div>
    </div>
  );
}
