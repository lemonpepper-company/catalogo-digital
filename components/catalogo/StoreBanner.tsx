import Image from "next/image";
import type { Store } from "@/lib/types";

export function StoreBanner({ store }: { store: Store }) {
  if (!store.coverUrl) return null;
  return (
    <div className="relative w-full aspect-[3/1] max-h-[160px] md:max-h-[220px] lg:max-h-[280px] overflow-hidden">
      <Image
        src={store.coverUrl}
        alt={`Capa da loja ${store.name}`}
        fill
        sizes="100vw"
        className="object-cover"
      />
    </div>
  );
}
