import { registrarEvento } from "@/app/actions/eventos";
import type { EventType } from "@/lib/validation/evento";

const VISITOR_KEY = "cd_visitor_id";
const VISITED_PREFIX = "cd_visited_";
const CONSENT_KEY = "cookie-consent";

/**
 * Identidade efêmera desta página. Usada quando o visitante recusou os cookies
 * (ANL-21) ou quando não há storage disponível (modo privado, storage cheio):
 * a contagem de únicos degrada, mas nada quebra e o evento continua sendo
 * registrado.
 */
let ephemeralVisitorId: string | null = null;

/** Dedup de visita em memória, para quando sessionStorage não existe. */
const visitedInMemory = new Set<string>();

function readStorage(storage: "localStorage" | "sessionStorage", key: string): string | null {
  try {
    return window[storage].getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(
  storage: "localStorage" | "sessionStorage",
  key: string,
  value: string
): boolean {
  try {
    window[storage].setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function newUuid(): string {
  return crypto.randomUUID();
}

function getEphemeralVisitorId(): string {
  ephemeralVisitorId ??= newUuid();
  return ephemeralVisitorId;
}

/**
 * UUID anônimo do visitante — nunca contém PII (ANL-06).
 *
 * Persiste em localStorage para que "visitantes únicos" faça sentido entre
 * sessões, EXCETO quando o visitante recusou explicitamente o banner de cookies:
 * aí o id vive só nesta página e nada é escrito no storage (ANL-21). Sem consent
 * registrado ("null") o banner nem foi respondido, então o padrão é persistir.
 */
export function getVisitorId(): string {
  if (readStorage("localStorage", CONSENT_KEY) === "rejected") {
    return getEphemeralVisitorId();
  }

  const stored = readStorage("localStorage", VISITOR_KEY);
  if (stored) return stored;

  const created = newUuid();
  // Storage indisponível: cai no id efêmero em vez de gerar um novo a cada
  // chamada, para que os eventos de uma mesma página compartilhem o visitante.
  if (!writeStorage("localStorage", VISITOR_KEY, created)) {
    return getEphemeralVisitorId();
  }
  return created;
}

/**
 * True apenas na primeira chamada por slug dentro da sessão do navegador
 * (ANL-01/02). O dedup é funcional — não rastreia o visitante entre sessões — e
 * por isso vale mesmo com o consentimento recusado.
 */
export function shouldTrackVisit(slug: string): boolean {
  const key = VISITED_PREFIX + slug;

  if (readStorage("sessionStorage", key)) return false;

  if (!writeStorage("sessionStorage", key, "1")) {
    if (visitedInMemory.has(key)) return false;
    visitedInMemory.add(key);
    return true;
  }

  return true;
}

/**
 * Dispara o evento sem bloquear nada (ANL-07). O retorno é `void` de propósito:
 * não existe Promise para alguém dar `await` por acidente no caminho crítico do
 * checkout, e qualquer falha morre no `.catch` — o servidor já loga.
 */
export function trackEvent(slug: string, eventType: EventType, productId?: string): void {
  try {
    void registrarEvento({
      slug,
      visitorId: getVisitorId(),
      eventType,
      productId: productId ?? null,
    }).catch(() => {});
  } catch {
    // Falha síncrona (storage exótico, action indisponível) não pode escapar
    // para o caminho de navegação/venda.
  }
}
