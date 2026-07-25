import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vtrinedigital.com.br";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/painel",
          "/api/",
          "/login",
          "/cadastro",
          "/recuperar-senha",
          "/redefinir-senha",
          "/verificar-email",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
