const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : "";
const supabaseProtocol = supabaseUrl
  ? new URL(supabaseUrl).protocol.replace(":", "")
  : "https";

// Em dev o Supabase roda em 127.0.0.1; o otimizador de imagem do Next 16 bloqueia
// hosts que resolvem para IP privado (proteção contra SSRF). Liberamos isso apenas
// fora de produção, onde a proteção continua ativa.
const allowLocalImageHost = process.env.NODE_ENV !== "production";

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    dangerouslyAllowLocalIP: allowLocalImageHost,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(supabaseHost
        ? [
            {
              protocol: supabaseProtocol,
              hostname: supabaseHost,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
