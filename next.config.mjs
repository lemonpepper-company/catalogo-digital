const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : "";
const supabaseProtocol = supabaseUrl
  ? new URL(supabaseUrl).protocol.replace(":", "")
  : "https";

// Em dev o Supabase roda em 127.0.0.1; o otimizador de imagem do Next 16 bloqueia
// hosts que resolvem para IP privado (proteção contra SSRF). Liberamos isso apenas
// fora de produção, onde a proteção continua ativa.
const allowLocalImageHost = process.env.NODE_ENV !== "production";

// React/Turbopack usam eval() em dev para HMR e stack traces; nunca em produção.
const scriptSrc = allowLocalImageHost
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://va.vercel-scripts.com"
  : "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://va.vercel-scripts.com";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: https://images.unsplash.com${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  `connect-src 'self' https://www.google-analytics.com${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}`,
  "font-src 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [{ key: "Content-Security-Policy", value: csp }],
    },
  ],
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
