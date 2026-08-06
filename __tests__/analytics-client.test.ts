import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const registrarEvento = vi.fn((_payload: unknown) => Promise.resolve({ ok: true }));

vi.mock("@/app/actions/eventos", () => ({
  registrarEvento: (payload: unknown) => registrarEvento(payload),
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cada `loadClient()` importa o módulo do zero — é o equivalente de "abrir outra
 * página": o id efêmero guardado em variável de módulo se perde, enquanto o que
 * está em localStorage sobrevive. É assim que ANL-21 é verificado.
 */
async function loadClient() {
  vi.resetModules();
  return import("@/lib/analytics-client");
}

function lastPayload(): Record<string, unknown> {
  return registrarEvento.mock.calls.at(-1)![0] as unknown as Record<string, unknown>;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  registrarEvento.mockClear();
  registrarEvento.mockImplementation(() => Promise.resolve({ ok: true }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getVisitorId — identidade anônima (ANL-06)", () => {
  it("gera um uuid e persiste em localStorage['cd_visitor_id']", async () => {
    const { getVisitorId } = await loadClient();

    const id = getVisitorId();

    expect(id).toMatch(UUID_RE);
    expect(localStorage.getItem("cd_visitor_id")).toBe(id);
  });

  it("reusa o id já persistido, inclusive depois de recarregar a página", async () => {
    const primeira = await loadClient();
    const id = primeira.getVisitorId();

    expect(primeira.getVisitorId()).toBe(id);

    const segunda = await loadClient();
    expect(segunda.getVisitorId()).toBe(id);
  });

  it("usa o mesmo id efêmero na página quando localStorage lança", async () => {
    const { getVisitorId } = await loadClient();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage indisponível");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage indisponível");
    });

    const primeiro = getVisitorId();
    const segundo = getVisitorId();

    expect(primeiro).toMatch(UUID_RE);
    expect(segundo).toBe(primeiro);
  });
});

describe("getVisitorId — consentimento recusado (ANL-21)", () => {
  it("não escreve cd_visitor_id no localStorage quando o consent é rejected", async () => {
    localStorage.setItem("cookie-consent", "rejected");
    const { getVisitorId } = await loadClient();

    const id = getVisitorId();

    expect(id).toMatch(UUID_RE);
    expect(localStorage.getItem("cd_visitor_id")).toBeNull();
  });

  it("mantém o id dentro da página, mas gera outro na página seguinte", async () => {
    localStorage.setItem("cookie-consent", "rejected");

    const primeira = await loadClient();
    const idA = primeira.getVisitorId();
    expect(primeira.getVisitorId()).toBe(idA);

    const segunda = await loadClient();
    const idB = segunda.getVisitorId();

    expect(idB).toMatch(UUID_RE);
    expect(idB).not.toBe(idA);
    expect(localStorage.getItem("cd_visitor_id")).toBeNull();
  });

  it("ignora um cd_visitor_id preexistente quando o consent vira rejected", async () => {
    localStorage.setItem("cd_visitor_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    localStorage.setItem("cookie-consent", "rejected");
    const { getVisitorId } = await loadClient();

    expect(getVisitorId()).not.toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("persiste normalmente com consent accepted ou sem consent registrado", async () => {
    for (const consent of ["accepted", null]) {
      localStorage.clear();
      if (consent) localStorage.setItem("cookie-consent", consent);
      const { getVisitorId } = await loadClient();

      const id = getVisitorId();

      expect(localStorage.getItem("cd_visitor_id")).toBe(id);
    }
  });

  it("continua registrando eventos com o consent recusado", async () => {
    localStorage.setItem("cookie-consent", "rejected");
    const { trackEvent } = await loadClient();

    trackEvent("loja-da-ana", "catalog_visit");

    expect(registrarEvento).toHaveBeenCalledTimes(1);
    expect(lastPayload().visitorId).toMatch(UUID_RE);
  });
});

describe("shouldTrackVisit — dedup de sessão (ANL-01/02)", () => {
  it("retorna true na primeira vez e false nas seguintes, marcando o sessionStorage", async () => {
    const { shouldTrackVisit } = await loadClient();

    expect(shouldTrackVisit("loja-da-ana")).toBe(true);
    expect(sessionStorage.getItem("cd_visited_loja-da-ana")).toBe("1");
    expect(shouldTrackVisit("loja-da-ana")).toBe(false);
  });

  it("continua retornando false depois de recarregar a página na mesma sessão", async () => {
    const primeira = await loadClient();
    expect(primeira.shouldTrackVisit("loja-da-ana")).toBe(true);

    const segunda = await loadClient();
    expect(segunda.shouldTrackVisit("loja-da-ana")).toBe(false);
  });

  it("deduplica por slug: outra loja ainda conta como primeira visita", async () => {
    const { shouldTrackVisit } = await loadClient();

    expect(shouldTrackVisit("loja-da-ana")).toBe(true);
    expect(shouldTrackVisit("outra-loja")).toBe(true);
    expect(shouldTrackVisit("loja-da-ana")).toBe(false);
  });

  it("deduplica em memória quando sessionStorage lança, sem propagar o erro", async () => {
    const { shouldTrackVisit } = await loadClient();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage indisponível");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage indisponível");
    });

    expect(shouldTrackVisit("loja-da-ana")).toBe(true);
    expect(shouldTrackVisit("loja-da-ana")).toBe(false);
  });
});

describe("trackEvent — disparo fire-and-forget (ANL-06/07)", () => {
  it("envia apenas slug, visitorId, eventType e productId — nada mais (ANL-06)", async () => {
    const { trackEvent, getVisitorId } = await loadClient();
    const id = getVisitorId();

    trackEvent("loja-da-ana", "product_view", "33333333-3333-4333-8333-333333333333");

    expect(registrarEvento).toHaveBeenCalledTimes(1);
    expect(lastPayload()).toEqual({
      slug: "loja-da-ana",
      visitorId: id,
      eventType: "product_view",
      productId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("envia productId null quando o evento não é sobre um produto", async () => {
    const { trackEvent } = await loadClient();

    trackEvent("loja-da-ana", "buy_click");

    expect(lastPayload().productId).toBeNull();
    expect(lastPayload().eventType).toBe("buy_click");
  });

  it("retorna undefined — nunca uma Promise que alguém possa aguardar (ANL-07)", async () => {
    const { trackEvent } = await loadClient();

    const retorno = trackEvent("loja-da-ana", "catalog_visit");

    expect(retorno).toBeUndefined();
  });

  it("não propaga rejeição da server action", async () => {
    registrarEvento.mockImplementation(() => Promise.reject(new Error("offline")));
    const { trackEvent } = await loadClient();

    expect(() => trackEvent("loja-da-ana", "catalog_visit")).not.toThrow();
    await Promise.resolve();
  });

  it("não propaga erro síncrono da server action", async () => {
    registrarEvento.mockImplementation(() => {
      throw new Error("action indisponível");
    });
    const { trackEvent } = await loadClient();

    expect(() => trackEvent("loja-da-ana", "add_to_bag", "33333333-3333-4333-8333-333333333333")).not.toThrow();
  });

  it("reusa o mesmo visitorId entre eventos da mesma página", async () => {
    const { trackEvent } = await loadClient();

    trackEvent("loja-da-ana", "catalog_visit");
    const primeiro = lastPayload().visitorId;
    trackEvent("loja-da-ana", "buy_click");

    expect(lastPayload().visitorId).toBe(primeiro);
  });
});
