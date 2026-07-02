function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Sk w="w-24" h="h-3" />
      <Sk w="w-full" h="h-11" rounded="rounded-input" />
    </div>
  );
}

export default function NovoProdutoLoading() {
  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <Sk w="w-40" h="h-7" />

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-5">
        <Sk w="w-16" h="h-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <FieldSkeleton wide />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton wide />
        </div>
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-24" h="h-4" />
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} w="w-16" h="h-8" rounded="rounded-pill" />
          ))}
        </div>
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-20" h="h-4" />
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} w="w-[100px] sm:w-[120px]" h="h-[100px] sm:h-[120px]" rounded="rounded-[10px]" />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <Sk w="w-24" h="h-11" rounded="rounded-btn" />
        <Sk w="w-36" h="h-11" rounded="rounded-btn" />
      </div>
    </div>
  );
}
