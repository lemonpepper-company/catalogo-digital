import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCatalogUrl } from "@/lib/catalog-url";
import type { Plan } from "@/lib/plan-limits";

function makeStore(overrides: {
  plan: Plan;
  trialEndsAt?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean;
}) {
  return {
    slug: "ateliemira",
    trialEndsAt: null,
    customDomain: null,
    customDomainVerified: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vtrine.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCatalogUrl", () => {
  it("usa o domínio próprio quando o plano tem a capability e o domínio está verificado", () => {
    const url = getCatalogUrl(
      makeStore({ plan: "pro", customDomain: "minhaloja.com.br", customDomainVerified: true })
    );

    expect(url).toBe("https://minhaloja.com.br");
  });

  it("usa o link de slug quando o domínio ainda não foi verificado", () => {
    const url = getCatalogUrl(
      makeStore({ plan: "pro", customDomain: "minhaloja.com.br", customDomainVerified: false })
    );

    expect(url).toBe("https://vtrine.test/ateliemira");
  });

  it("usa o link de slug quando não há domínio cadastrado", () => {
    const url = getCatalogUrl(makeStore({ plan: "pro" }));

    expect(url).toBe("https://vtrine.test/ateliemira");
  });

  it("usa o link de slug quando o plano não tem a capability de domínio próprio (Starter)", () => {
    const url = getCatalogUrl(
      makeStore({ plan: "starter", customDomain: "minhaloja.com.br", customDomainVerified: true })
    );

    expect(url).toBe("https://vtrine.test/ateliemira");
  });

  it("cai para o link de slug quando o acesso Pro expirou (trial_ends_at vencido)", () => {
    const url = getCatalogUrl(
      makeStore({
        plan: "pro",
        trialEndsAt: "2020-01-01T00:00:00.000Z",
        customDomain: "minhaloja.com.br",
        customDomainVerified: true,
      })
    );

    expect(url).toBe("https://vtrine.test/ateliemira");
  });
});
