export function isOwnHost(hostname: string, siteUrl: string | undefined): boolean {
  if (!siteUrl) return true;

  let ownHostname: string;
  try {
    ownHostname = new URL(siteUrl).hostname;
  } catch {
    return true;
  }

  return (
    hostname === ownHostname ||
    hostname === "localhost" ||
    hostname.endsWith(".vercel.app")
  );
}

/**
 * Apex é o formato canônico de custom_domain (domainSchema já normaliza ao
 * salvar) — mas provedores de DNS/Vercel costumam redirecionar apex↔www
 * automaticamente, então o Host de uma request pode chegar com o prefixo
 * mesmo quando o lojista cadastrou sem ele. Remove só um "www." líder (não
 * qualquer ocorrência) para os dois formatos apontarem pra mesma loja.
 */
export function stripWwwPrefix(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}
