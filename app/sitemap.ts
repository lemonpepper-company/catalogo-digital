import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vtrinedigital.com.br";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/landing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/politica-de-privacidade`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/termos-de-uso`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  try {
    const supabase = await createClient();
    const { data: stores } = await supabase
      .from("stores")
      .select("slug, updated_at")
      .not("slug", "is", null);

    const storePages: MetadataRoute.Sitemap = (stores ?? []).map((store) => ({
      url: `${siteUrl}/${store.slug}`,
      lastModified: store.updated_at ? new Date(store.updated_at) : new Date(),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

    return [...staticPages, ...storePages];
  } catch {
    return staticPages;
  }
}
