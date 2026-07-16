function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

export default function PersonalizacaoLoading() {
  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <Sk w="w-44" h="h-7" />

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-32" h="h-4" />
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-sand/70 animate-pulse" />
          ))}
        </div>
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-28" h="h-4" />
        <Sk w="w-full" h="h-40" rounded="rounded-card" />
        <Sk w="w-40" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <Sk w="w-24" h="h-11" rounded="rounded-btn" />
        <Sk w="w-44" h="h-11" rounded="rounded-btn" />
      </div>
    </div>
  );
}
