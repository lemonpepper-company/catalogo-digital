import Image from "next/image";
import type { Store } from "@/lib/types";

export function StoreBanner({ store }: { store: Store }) {
  if (!store.coverUrl) return null;
  return (
    <div className="w-full bg-linen">
      <div className="w-full md:max-w-page md:mx-auto md:px-8 lg:px-12">
        <Image
          src={store.coverUrl}
          alt={`Capa da loja ${store.name}`}
          width={1200}
          height={400}
          sizes="(min-width: 1280px) 1200px, 100vw"
          className="w-full h-auto aspect-auto md:rounded-card"
        />
      </div>
    </div>
  );
}
