function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <Sk w="w-24" h="h-3" />
      <Sk w="w-full" h="h-11" rounded="rounded-input" />
    </div>
  );
}

export default function ConfiguracoesLoading() {
  return (
    <div className="max-w-form flex flex-col gap-5">
      <Sk w="w-52" h="h-7" />

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-5">
        <Sk w="w-20" h="h-4" />
        <div className="flex gap-5 items-center">
          <div className="w-[72px] h-[72px] rounded-full bg-sand/70 animate-pulse flex-shrink-0" />
          <Sk w="w-32" h="h-11" rounded="rounded-btn" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-32" h="h-4" />
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-sand/70 animate-pulse" />
          ))}
        </div>
        <Sk w="w-44" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-40" h="h-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Sk w="w-full" h="h-48" rounded="rounded-input" />
          <Sk w="w-full" h="h-48" rounded="rounded-card" />
        </div>
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-24" h="h-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <Sk w="w-24" h="h-11" rounded="rounded-btn" />
        <Sk w="w-44" h="h-11" rounded="rounded-btn" />
      </div>
    </div>
  );
}
