import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCatalog } from "@/lib/server/catalog";
import { CatalogExpired } from "@/components/catalogo/CatalogExpired";
import { CatalogoClient } from "./CatalogoClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getPublicCatalog(slug);
  if (catalog.status === "not_found") {
    return { title: "Catálogo não encontrado" };
  }
  const title = `${catalog.store.name} — Vitrine e catálogo | Vtrine Digital`;
  const description =
    catalog.store.description ||
    `Veja o catálogo de ${catalog.store.name} e compre pelo WhatsApp.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default async function CatalogoSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const catalog = await getPublicCatalog(slug);

  if (catalog.status === "not_found") notFound();
  if (catalog.status === "hidden") return <CatalogExpired store={catalog.store} />;

  return <CatalogoClient store={catalog.store} products={catalog.products} />;
}
