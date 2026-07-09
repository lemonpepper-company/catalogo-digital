const BASE = "http://localhost";

export function getSafeRedirect(next: string | null, fallback: string): string {
  if (!next) return fallback;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return fallback;
  }

  if (url.origin !== BASE) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
