import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  features,
  faqs,
  freeFeatures,
  starterFeatures,
  proFeatures,
} from "@/app/landing/data";

const ORDER_HISTORY = "Histórico de pedidos";

describe("features — card de histórico de pedidos (ORD-25/AC1)", () => {
  it("tem um card 'Histórico de pedidos' descrevendo pedido registrado com itens e total", () => {
    const card = features.find((f) => f.title === ORDER_HISTORY);
    expect(card).toBeDefined();
    const desc = card?.desc ?? "";
    expect(desc).toMatch(/registrad/i);
    expect(desc).toMatch(/itens/i);
    expect(desc).toMatch(/total/i);
  });

  it("deixa claro no card que o histórico é recurso dos planos pagos", () => {
    const desc = features.find((f) => f.title === ORDER_HISTORY)?.desc ?? "";
    expect(desc).toMatch(/pagos|Starter/i);
  });
});

describe("faqs — pergunta sobre o pedido registrado (ORD-25/AC2)", () => {
  const faq = faqs.find((f) => /registrad/i.test(f.q));

  it("existe uma pergunta sobre o pedido ficar registrado, mesmo indo para o WhatsApp", () => {
    expect(faq).toBeDefined();
    expect(faq?.q ?? "").toMatch(/WhatsApp/i);
    expect(faq?.a ?? "").toMatch(/painel/i);
  });

  it("a resposta deixa claro que não há checkout nem pagamento no site", () => {
    const answer = faq?.a ?? "";
    expect(answer).toMatch(/não existe checkout/i);
    expect(answer).toMatch(/pagamento/i);
  });

  it("a resposta informa que o histórico começa no plano Starter", () => {
    expect(faq?.a ?? "").toMatch(/plano Starter/i);
  });
});

describe("bullets de plano (ORD-25/AC3)", () => {
  it("Starter lista 'Histórico de pedidos'", () => {
    expect(starterFeatures).toContain(ORDER_HISTORY);
  });

  it("Pro lista 'Histórico de pedidos'", () => {
    expect(proFeatures).toContain(ORDER_HISTORY);
  });

  it("Free não lista histórico de pedidos em nenhuma variação", () => {
    expect(freeFeatures).not.toContain(ORDER_HISTORY);
    expect(freeFeatures.some((f) => /hist(ó|o)rico/i.test(f))).toBe(false);
  });
});

const DASHBOARD_FEATURE = "Dashboard com métricas de vendas";

describe("bullets de plano — Dashboard exclusiva de planos pagos (ORD-48)", () => {
  it("Starter lista 'Dashboard com métricas de vendas'", () => {
    expect(starterFeatures).toContain(DASHBOARD_FEATURE);
  });

  it("Pro lista 'Dashboard com métricas de vendas'", () => {
    expect(proFeatures).toContain(DASHBOARD_FEATURE);
  });

  it("Free não lista Dashboard em nenhuma variação", () => {
    expect(freeFeatures).not.toContain(DASHBOARD_FEATURE);
    expect(freeFeatures.some((f) => /dashboard/i.test(f))).toBe(false);
  });
});

const VITRINE_FEATURE = "Métricas de visitas da vitrine";

describe("bullets de plano — métricas da vitrine exclusivas do Pro (APO-16)", () => {
  it("Pro lista as métricas de visitas da vitrine", () => {
    expect(proFeatures).toContain(VITRINE_FEATURE);
  });

  it("Starter não lista métricas de visitas em nenhuma variação", () => {
    expect(starterFeatures).not.toContain(VITRINE_FEATURE);
    expect(starterFeatures.some((f) => /visita/i.test(f))).toBe(false);
  });

  it("Free não lista métricas de visitas em nenhuma variação", () => {
    expect(freeFeatures).not.toContain(VITRINE_FEATURE);
    expect(freeFeatures.some((f) => /visita/i.test(f))).toBe(false);
  });

  it("o dashboard de vendas continua sendo bullet dos dois planos pagos", () => {
    expect(starterFeatures).toContain(DASHBOARD_FEATURE);
    expect(proFeatures).toContain(DASHBOARD_FEATURE);
  });
});

describe("bullets de plano — cor secundária deixou de ser diferencial", () => {
  it("nenhum plano anuncia cor secundária", () => {
    for (const features of [freeFeatures, starterFeatures, proFeatures]) {
      expect(features.some((f) => /secund(á|a)ria/i.test(f))).toBe(false);
    }
  });

  it("Starter anuncia os limites novos", () => {
    expect(starterFeatures).toContain("Até 50 produtos");
    expect(starterFeatures).toContain("7 categorias");
  });
});

describe("preços publicados na landing", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  it("exibe os valores mensais", () => {
    expect(page).toMatch(/R\$ 29,90/);
    expect(page).toMatch(/R\$ 59,90/);
  });

  it("exibe o anual como mensalidade equivalente", () => {
    expect(page).toMatch(/R\$ 24,92\/mês, cobrado anualmente/);
    expect(page).toMatch(/R\$ 49,92\/mês, cobrado anualmente/);
  });

  it("não resta 'Sob consulta'", () => {
    expect(page).not.toMatch(/Sob consulta/);
  });
});
