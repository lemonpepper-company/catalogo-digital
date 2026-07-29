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
