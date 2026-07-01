import { Store as StoreIcon } from "lucide-react";
import type { Store } from "@/lib/types";

interface CatalogExpiredProps {
  store: Store;
}

export function CatalogExpired({ store }: CatalogExpiredProps) {
  return (
    <div className="min-h-screen bg-ivory flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center text-inactive">
        <StoreIcon size={28} />
      </div>
      <h1 className="font-display font-semibold text-[22px] text-obsidian leading-snug">
        {store.name}
      </h1>
      <p className="font-body text-[15px] text-graphite leading-relaxed max-w-sm">
        Este catálogo está indisponível no momento. Volte em breve.
      </p>
    </div>
  );
}
