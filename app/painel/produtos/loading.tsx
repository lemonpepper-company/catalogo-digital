import { ProductRowSkeleton } from "@/components/painel/ProductRowSkeleton";

function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

export default function ProdutosLoading() {
  return (
    <div className="w-full lg:max-w-content flex flex-col gap-6">
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
