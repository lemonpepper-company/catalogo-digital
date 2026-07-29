import { describe, it, expect, vi } from "vitest";
import { MSG_DEFAULT, MSG_VARS } from "@/app/painel/configuracoes/use-configuracoes";
import { buildWhatsAppMessage, renderWhatsAppMessage, type OrderInfo } from "@/lib/utils";

// A Server Action é importada pelo hook no escopo do módulo; o mock evita subir o
// client do Supabase só para ler duas constantes.
vi.mock("@/app/actions/store", () => ({
  updateStoreSettings: vi.fn(),
}));

/**
 * ORD-33.5: o formato padrão existe em duas fontes — `buildWhatsAppMessage`
 * (loja com `message_template` nulo) e `MSG_DEFAULT` (textarea das configurações
 * e botão "Restaurar padrão"). Elas são sincronizadas na mão: se divergirem,
 * "loja nova" e "Restaurar padrão" passam a gerar mensagens diferentes para os
 * mesmos dados. Este arquivo é o cadeado dessa paridade.
 */
const items = [
  { product: { name: "Vestido midi", price: "R$ 289,90" }, size: "M", color: "Areia", qty: 2 },
  { product: { name: "Blusa de tricô", price: "R$ 169,90" }, size: null, color: null, qty: 1 },
];

const scenarios: [string, OrderInfo | undefined][] = [
  [
    "pedido completo (nome, código, pagamento e entrega com endereço)",
    {
      customerName: "Ana Maria",
      code: "HS0L52",
      payment: "pix",
      delivery: "entrega",
      address: "Rua X, 123",
    },
  ],
  [
    "loja sem pagamento e entrega configurados",
    { customerName: "Ana Maria", code: "HS0L52" },
  ],
  ["sem nome informado", { code: "HS0L52", payment: "pix", delivery: "retirada" }],
  ["sem código", { customerName: "Ana Maria", payment: "pix", delivery: "retirada" }],
  ["sem nenhum dado de pedido", undefined],
];

describe("paridade entre MSG_DEFAULT e buildWhatsAppMessage (ORD-33.5)", () => {
  it.each(scenarios)(
    "MSG_DEFAULT renderizado produz o mesmo texto do formato padrão — %s",
    (_label, order) => {
      expect(renderWhatsAppMessage(MSG_DEFAULT, items, order)).toBe(
        buildWhatsAppMessage(items, order)
      );
    }
  );

  it("o formato padrão das duas fontes traz nome e código (ORD-33.4, ORD-33.5)", () => {
    const order: OrderInfo = { customerName: "Ana Maria", code: "HS0L52" };
    const restaurado = renderWhatsAppMessage(MSG_DEFAULT, items, order);

    expect(restaurado).toContain("Cliente: Ana Maria");
    expect(restaurado).toContain("Pedido: HS0L52");
    expect(buildWhatsAppMessage(items, order)).toContain("Cliente: Ana Maria");
    expect(buildWhatsAppMessage(items, order)).toContain("Pedido: HS0L52");
  });

  it("MSG_DEFAULT usa as variáveis {nome} e {pedido} (ORD-33.5)", () => {
    expect(MSG_DEFAULT).toContain("{nome}");
    expect(MSG_DEFAULT).toContain("{pedido}");
  });

  it("todas as variáveis de MSG_DEFAULT estão oferecidas como chips (ORD-34.7)", () => {
    const tokens = MSG_VARS.map((v) => v.token);
    expect(tokens).toContain("{nome}");
    expect(tokens).toContain("{pedido}");
    for (const token of MSG_DEFAULT.match(/\{[a-z]+\}/g) ?? []) {
      expect(tokens).toContain(token);
    }
  });

  it("nenhum chip resolve para o próprio token (toda variável é substituída)", () => {
    const order: OrderInfo = {
      customerName: "Ana Maria",
      code: "HS0L52",
      payment: "pix",
      delivery: "retirada",
    };
    for (const { token } of MSG_VARS) {
      expect(renderWhatsAppMessage(token, items, order)).not.toContain(token);
    }
  });
});
