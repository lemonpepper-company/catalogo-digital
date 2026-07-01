import { describe, it, expect } from "vitest";
import { parsePrice, formatMoney, buildWhatsAppMessage, renderWhatsAppMessage, formatItemsBlock, WHATSAPP_GREETING, cn, parseReaisToCents, formatCents } from "@/lib/utils";

describe("parsePrice", () => {
  it("parses a Brazilian real price string", () => {
    expect(parsePrice("R$ 289,90")).toBeCloseTo(289.9, 2);
  });

  it("parses whole numbers", () => {
    expect(parsePrice("R$ 100,00")).toBeCloseTo(100, 2);
  });
});

describe("formatMoney", () => {
  it("starts with R$", () => {
    expect(formatMoney(289.9)).toMatch(/^R\$/);
  });

  it("uses comma as decimal separator", () => {
    expect(formatMoney(289.9)).toMatch(/\d+,\d{2}$/);
  });

  it("round-trips with parsePrice", () => {
    const original = 289.9;
    const formatted = formatMoney(original);
    expect(parsePrice(formatted)).toBeCloseTo(original, 2);
  });

  it("formats zero as two decimal places", () => {
    expect(formatMoney(0)).toMatch(/0,00$/);
  });

  it("includes the numeric value", () => {
    const result = formatMoney(99.9);
    expect(result).toMatch(/99/);
  });
});

describe("buildWhatsAppMessage", () => {
  it("includes product name", () => {
    const items = [
      {
        product: { name: "Vestido midi", price: "R$ 100,00" },
        size: "M",
        color: "Areia",
        qty: 2,
      },
    ];
    const msg = buildWhatsAppMessage(items);
    expect(msg).toContain("Vestido midi");
  });

  it("includes tamanho when size is provided", () => {
    const items = [
      {
        product: { name: "Vestido midi", price: "R$ 100,00" },
        size: "M",
        color: "Areia",
        qty: 1,
      },
    ];
    const msg = buildWhatsAppMessage(items);
    expect(msg).toContain("Tamanho: M");
  });

  it("includes cor when color is provided", () => {
    const items = [
      {
        product: { name: "Vestido midi", price: "R$ 100,00" },
        size: null,
        color: "Areia",
        qty: 1,
      },
    ];
    const msg = buildWhatsAppMessage(items);
    expect(msg).toContain("Cor: Areia");
  });

  it("omits size line when size is null", () => {
    const items = [
      {
        product: { name: "Saia", price: "R$ 50,00" },
        size: null,
        color: null,
        qty: 1,
      },
    ];
    const msg = buildWhatsAppMessage(items);
    expect(msg).not.toContain("Tamanho:");
    expect(msg).not.toContain("Cor:");
  });

  it("shows correct quantity", () => {
    const items = [
      {
        product: { name: "Blusa", price: "R$ 80,00" },
        size: "P",
        color: null,
        qty: 3,
      },
    ];
    const msg = buildWhatsAppMessage(items);
    expect(msg).toContain("3x");
  });

  it("includes total line", () => {
    const items = [
      {
        product: { name: "Blusa", price: "R$ 80,00" },
        size: "P",
        color: null,
        qty: 3,
      },
    ];
    const msg = buildWhatsAppMessage(items);
    expect(msg).toContain("Total");
  });
});

describe("buildWhatsAppMessage — formato padrão (§8)", () => {
  it("mantém o formato exato do Escopo §8", () => {
    const items = [
      { product: { name: "Produto Exemplo", price: "R$ 50,00" }, size: "M", color: "Preto", qty: 2 },
    ];
    const expected = [
      "Olá! Gostaria de fazer um pedido:",
      "",
      "01. Produto Exemplo",
      `    Quantidade: 2x | Valor unitário: ${formatMoney(50)}`,
      "    Tamanho: M",
      "    Cor: Preto",
      `    Subtotal: ${formatMoney(100)}`,
      "",
      "━━━━━━━━━━━━━━━━━",
      `*Total: ${formatMoney(100)}*`,
      "━━━━━━━━━━━━━━━━━",
    ].join("\n");
    expect(buildWhatsAppMessage(items)).toBe(expected);
  });
});

describe("renderWhatsAppMessage (CAT-07, CAT-08)", () => {
  const items = [
    { product: { name: "Vestido", price: "R$ 100,00" }, size: "M", color: "Areia", qty: 2 },
    { product: { name: "Blusa", price: "R$ 50,00" }, size: null, color: null, qty: 1 },
  ];

  it("template nulo → formato padrão idêntico ao buildWhatsAppMessage (CAT-08)", () => {
    expect(renderWhatsAppMessage(null, items)).toBe(buildWhatsAppMessage(items));
  });

  it("template vazio/espaços → formato padrão (CAT-08)", () => {
    expect(renderWhatsAppMessage("   ", items)).toBe(buildWhatsAppMessage(items));
  });

  it("substitui {saudacao} pela saudação padrão (CAT-07)", () => {
    expect(renderWhatsAppMessage("{saudacao}", items)).toBe(WHATSAPP_GREETING);
  });

  it("substitui {total} pelo total formatado (CAT-07)", () => {
    expect(renderWhatsAppMessage("Total: {total}", items)).toBe(`Total: ${formatMoney(250)}`);
  });

  it("substitui {itens} pelo bloco numerado com todos os itens (CAT-07)", () => {
    const msg = renderWhatsAppMessage("Pedido:\n{itens}", items);
    expect(msg).toContain("01. Vestido");
    expect(msg).toContain("02. Blusa");
    expect(msg).toBe(`Pedido:\n${formatItemsBlock(items)}`);
  });

  it("mantém variável desconhecida literal (CAT-08 edge case)", () => {
    const msg = renderWhatsAppMessage("{foo} custa {total}", items);
    expect(msg).toBe(`{foo} custa ${formatMoney(250)}`);
  });
});

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("returns empty string for all falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});

describe("parseReaisToCents", () => {
  it("converte '289,90' em 28990", () => {
    expect(parseReaisToCents("289,90")).toBe(28990);
  });

  it("aceita prefixo R$ e espaços", () => {
    expect(parseReaisToCents("R$ 1.299,00")).toBe(129900);
  });

  it("trata inteiro sem centavos", () => {
    expect(parseReaisToCents("50")).toBe(5000);
  });

  it("retorna NaN para entrada vazia", () => {
    expect(Number.isNaN(parseReaisToCents(""))).toBe(true);
  });
});

describe("formatCents", () => {
  it("formata 28990 como 'R$ 289,90'", () => {
    expect(formatCents(28990)).toBe("R$ 289,90");
  });

  it("formata 5000 como 'R$ 50,00'", () => {
    expect(formatCents(5000)).toBe("R$ 50,00");
  });
});
