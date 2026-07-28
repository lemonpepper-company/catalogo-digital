import { describe, it, expect } from "vitest";
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
