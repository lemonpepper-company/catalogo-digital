import { describe, it, expect } from "vitest";
import {
  PLACEHOLDER_IMAGE,
  initialsFromName,
  mapPublicStore,
  mapPublicProduct,
  computePills,
  resolveCatalog,
  normalizeSearch,
  filterCatalog,
  type PublicStoreRow,
  type PublicProductRow,
  type PublicCategoryRow,
} from "@/lib/catalog";
import type { Product } from "@/lib/types";

const storeRow: PublicStoreRow = {
  id: "s1",
  name: "Ateliê Mira",
  slug: "atelie-mira",
  is_active: true,
  whatsapp: "5511999990000",
  accent_color: "#C9A96E",
  logo_url: null,
  cover_url: null,
  description: "Vitrine premium",
  monogram: "AM",
  analytics_id: null,
  pixel_id: null,
  message_template: null,
  instagram: null,
  payment_methods: null,
  delivery_methods: null,
  font_pairing: "padrao",
  background_palette: "padrao",
  corner_style: "padrao",
  secondary_color: null,
  grid_density: "padrao",
};

function product(overrides: Partial<PublicProductRow>): PublicProductRow {
  return {
    id: "p1",
    name: "Vestido",
    price_cents: 28990,
    description: "Peça linda",
    category_id: "c1",
    sizes: ["P", "M"],
    sold_sizes: [],
    colors: [{ label: "Areia", hex: "#D8C9B0" }],
    images: ["https://img/x.jpg"],
    stock: 5,
    is_active: true,
    is_new: true,
    is_featured: false,
    ...overrides,
  };
}

const catVestidos: PublicCategoryRow = { id: "c1", name: "Vestidos", position: 0 };
const catBlusas: PublicCategoryRow = { id: "c2", name: "Blusas", position: 1 };

describe("initialsFromName", () => {
  it("usa as iniciais de até duas palavras", () => {
    expect(initialsFromName("Ateliê Mira")).toBe("AM");
  });
  it("uma palavra vira uma inicial", () => {
    expect(initialsFromName("Boutique")).toBe("B");
  });
});

describe("mapPublicProduct (CAT-06)", () => {
  it("formata price_cents como string em reais", () => {
    expect(mapPublicProduct(product({ price_cents: 28990 }), "Vestidos").price).toBe(
      "R$ 289,90"
    );
  });
  it("usa a primeira imagem de images[]", () => {
    expect(
      mapPublicProduct(product({ images: ["a.jpg", "b.jpg"] }), "Vestidos").image
    ).toBe("a.jpg");
  });
  it("usa placeholder quando images está vazio", () => {
    expect(mapPublicProduct(product({ images: [] }), "Vestidos").image).toBe(
      PLACEHOLDER_IMAGE
    );
  });
  it("usa placeholder quando images é null", () => {
    expect(mapPublicProduct(product({ images: null }), "Vestidos").image).toBe(
      PLACEHOLDER_IMAGE
    );
  });
  it("cai em 'Todos' quando não há categoria", () => {
    expect(mapPublicProduct(product({ category_id: null }), null).category).toBe(
      "Todos"
    );
  });
});

describe("mapPublicStore", () => {
  it("deriva monograma das iniciais quando ausente", () => {
    expect(mapPublicStore({ ...storeRow, monogram: null }, [], "pro").monogram).toBe("AM");
  });
  it("mapeia whatsapp nulo para string vazia", () => {
    expect(mapPublicStore({ ...storeRow, whatsapp: null }, [], "pro").whatsapp).toBe("");
  });
  it("propaga o message_template para messageTemplate", () => {
    expect(
      mapPublicStore({ ...storeRow, message_template: "Oi {itens}" }, [], "pro").messageTemplate
    ).toBe("Oi {itens}");
  });
  it("propaga cover_url para coverUrl", () => {
    expect(
      mapPublicStore({ ...storeRow, cover_url: "https://img/capa.jpg" }, [], "pro").coverUrl
    ).toBe("https://img/capa.jpg");
  });
  it("mapeia cover_url nulo para null", () => {
    expect(mapPublicStore({ ...storeRow, cover_url: null }, [], "pro").coverUrl).toBeNull();
  });
  it("expõe o slug da loja explicitamente", () => {
    expect(mapPublicStore({ ...storeRow, slug: "loja-da-ana" }, [], "pro").slug).toBe(
      "loja-da-ana"
    );
  });
  it("mantém slug e catalogUrl independentes, ambos vindos de row.slug", () => {
    const store = mapPublicStore({ ...storeRow, slug: "atelie-mira" }, [], "pro");
    expect(store.slug).toBe("atelie-mira");
    expect(store.catalogUrl).toBe("atelie-mira");
  });
});

describe("computePills (CAT-02)", () => {
  it("começa com 'Todos'", () => {
    expect(computePills([], [])[0]).toBe("Todos");
  });
  it("inclui apenas categorias com produto visível", () => {
    const pills = computePills(
      [catVestidos, catBlusas],
      [product({ category_id: "c1" })]
    );
    expect(pills).toEqual(["Todos", "Vestidos"]);
  });
  it("omite categoria sem produtos", () => {
    const pills = computePills([catVestidos, catBlusas], []);
    expect(pills).toEqual(["Todos"]);
  });
});

function vm(overrides: Partial<Product>): Product {
  return {
    id: "p1",
    name: "Vestido Longo",
    price: "R$ 289,90",
    category: "Vestidos",
    image: "x.jpg",
    desc: "",
    sizes: [],
    soldSizes: [],
    colors: [],
    isFeatured: false,
    ...overrides,
  };
}

describe("normalizeSearch", () => {
  it("baixa a caixa e remove acentos", () => {
    expect(normalizeSearch("Véstido")).toBe("vestido");
    expect(normalizeSearch("SEDA")).toBe("seda");
  });
});

describe("filterCatalog (CAT-B02..B05)", () => {
  const catalog: Product[] = [
    vm({ id: "a", name: "Vestido Longo", category: "Vestidos" }),
    vm({ id: "b", name: "Blusa de Seda", category: "Blusas" }),
    vm({ id: "c", name: "Vestido de Seda", category: "Vestidos" }),
  ];

  it("casa substring do nome ignorando caixa (CAT-B02)", () => {
    expect(filterCatalog(catalog, "Todos", "VEST").map((p) => p.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("casa nome ignorando acentos (CAT-B02)", () => {
    const withAccent = [vm({ id: "x", name: "Véstido de Festa", category: "Vestidos" })];
    expect(filterCatalog(withAccent, "Todos", "vest")).toHaveLength(1);
  });

  it("interseção categoria ∩ nome (CAT-B03)", () => {
    // "seda" existe em Blusas e Vestidos; categoria Blusas deve retornar só a blusa
    expect(filterCatalog(catalog, "Blusas", "seda").map((p) => p.id)).toEqual(["b"]);
  });

  it("termo só com espaços = sem filtro de nome (CAT-B04)", () => {
    expect(filterCatalog(catalog, "Vestidos", "   ").map((p) => p.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("termo sem correspondência retorna vazio (CAT-B05)", () => {
    expect(filterCatalog(catalog, "Todos", "sapato")).toEqual([]);
  });
});

describe("resolveCatalog — visibilidade (CAT-10, CAT-03)", () => {
  it("slug inexistente → not_found", () => {
    expect(resolveCatalog(null, [], [], "pro").status).toBe("not_found");
  });
  it("loja inativa → hidden", () => {
    const r = resolveCatalog({ ...storeRow, is_active: false }, [product({})], [catVestidos], "pro");
    expect(r.status).toBe("hidden");
  });
  it("loja ativa → ok", () => {
    const r = resolveCatalog(storeRow, [product({})], [catVestidos], "pro");
    expect(r.status).toBe("ok");
  });
});

describe("resolveCatalog — montagem (CAT-01, CAT-06)", () => {
  it("mapeia produtos com nome da categoria resolvido", () => {
    const r = resolveCatalog(storeRow, [product({ category_id: "c1" })], [catVestidos], "pro");
    if (r.status !== "ok") throw new Error("esperado ok");
    expect(r.products).toHaveLength(1);
    expect(r.products[0].category).toBe("Vestidos");
    expect(r.products[0].price).toBe("R$ 289,90");
  });
  it("expõe as pills na store", () => {
    const r = resolveCatalog(storeRow, [product({ category_id: "c1" })], [catVestidos, catBlusas], "pro");
    if (r.status !== "ok") throw new Error("esperado ok");
    expect(r.store.categories).toEqual(["Todos", "Vestidos"]);
  });
  it("loja vazia → ok com zero produtos e só 'Todos'", () => {
    const r = resolveCatalog(storeRow, [], [catVestidos], "pro");
    if (r.status !== "ok") throw new Error("esperado ok");
    expect(r.products).toHaveLength(0);
    expect(r.store.categories).toEqual(["Todos"]);
  });
});

describe("mapPublicStore — perfil social e checkout (novo)", () => {
  it("mapeia instagram, payment_methods e delivery_methods quando presentes", () => {
    const store = mapPublicStore(
      {
        ...storeRow,
        instagram: "atelieming",
        payment_methods: ["pix"],
        delivery_methods: ["retirada", "entrega"],
      },
      [],
      "pro"
    );
    expect(store.instagram).toBe("atelieming");
    expect(store.paymentMethods).toEqual(["pix"]);
    expect(store.deliveryMethods).toEqual(["retirada", "entrega"]);
  });

  it("usa arrays vazios quando payment_methods/delivery_methods são null", () => {
    const store = mapPublicStore(storeRow, [], "pro");
    expect(store.paymentMethods).toEqual([]);
    expect(store.deliveryMethods).toEqual([]);
    expect(store.instagram).toBeUndefined();
  });
});

function baseStoreRow(overrides: Partial<PublicStoreRow> = {}): PublicStoreRow {
  return {
    id: "store-1",
    name: "Loja Teste",
    slug: "loja-teste",
    is_active: true,
    whatsapp: "5511999990000",
    accent_color: "#C9A96E",
    logo_url: null,
    cover_url: null,
    description: null,
    monogram: null,
    analytics_id: null,
    pixel_id: null,
    message_template: null,
    instagram: null,
    payment_methods: [],
    delivery_methods: [],
    font_pairing: "padrao",
    background_palette: "padrao",
    corner_style: "padrao",
    secondary_color: null,
    grid_density: "padrao",
    ...overrides,
  };
}

describe("resolveCatalog — gating de tema/densidade/destaques por plano", () => {
  // effectivePlan chega separado do storeRow — resolvido antes, via RPC
  // get_effective_plan (Task 1), nunca lido de plan/trial_ends_at cru.
  it("loja free: ignora fonte/fundo/cantos e densidade não-padrão mesmo se salvos no banco", () => {
    const store = baseStoreRow({
      font_pairing: "editorial",
      background_palette: "areia",
      corner_style: "arredondado",
      grid_density: "compacto",
    });
    const result = resolveCatalog(store, [], [], "free");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.fontDisplayVar).toBe("--font-sora");
    expect(result.store.theme.backgroundColor).toBe("#F9F9F7");
    expect(result.store.theme.cardRadius).toBe("16px");
    expect(result.store.gridDensity).toBe("padrao");
  });

  it("loja starter: aplica fonte/fundo/cantos e densidade salvos, de forma independente", () => {
    const store = baseStoreRow({
      font_pairing: "classico",
      background_palette: "cinza",
      corner_style: "reto",
      grid_density: "compacto",
    });
    const result = resolveCatalog(store, [], [], "starter");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.fontDisplayVar).toBe("--font-playfair");
    expect(result.store.theme.backgroundColor).toBe("#EEEEEC");
    expect(result.store.theme.cardRadius).toBe("4px");
    expect(result.store.gridDensity).toBe("compacto");
  });

  it("loja free: aplica cor secundária salva (disponível em todos os planos)", () => {
    const store = baseStoreRow({ secondary_color: "#112233" });
    const result = resolveCatalog(store, [], [], "free");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.secondaryColor).toBe("#112233");
  });

  it("loja pro: aplica cor secundária salva", () => {
    const store = baseStoreRow({ secondary_color: "#112233" });
    const result = resolveCatalog(store, [], [], "pro");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.secondaryColor).toBe("#112233");
  });
});

describe("resolveCatalog — degradação por plano", () => {
  function row(id: string, over: Partial<PublicProductRow> = {}): PublicProductRow {
    return {
      id,
      name: `Produto ${id}`,
      price_cents: 1000,
      description: null,
      category_id: null,
      sizes: null,
      sold_sizes: null,
      colors: null,
      images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"],
      stock: 5,
      is_active: true,
      is_new: false,
      is_featured: false,
      ...over,
    };
  }

  const categorias: PublicCategoryRow[] = [
    { id: "c1", name: "Vestidos", position: 1 },
    { id: "c2", name: "Blusas", position: 2 },
  ];

  it("loja Pro rebaixada para Free exibe 8 produtos, 1 foto e nenhum destaque", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row(`p${i}`, { is_featured: true, category_id: i < 20 ? "c1" : "c2" })
    );
    const result = resolveCatalog(storeRow, rows, categorias, "free");
    if (result.status !== "ok") throw new Error("esperava status ok");

    expect(result.products).toHaveLength(8);
    expect(result.products[0].images).toEqual(["1.jpg"]);
    expect(result.products.some((p) => p.isFeatured)).toBe(false);
    expect(result.store.categories).toEqual(["Todos", "Vestidos"]);
  });

  it("mesma loja em Pro exibe tudo", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row(`p${i}`, { is_featured: true, category_id: i < 20 ? "c1" : "c2" })
    );
    const result = resolveCatalog(storeRow, rows, categorias, "pro");
    if (result.status !== "ok") throw new Error("esperava status ok");

    expect(result.products).toHaveLength(30);
    expect(result.products[0].images).toHaveLength(5);
    expect(result.products.every((p) => p.isFeatured)).toBe(true);
    expect(result.store.categories).toEqual(["Todos", "Vestidos", "Blusas"]);
  });

  it("produto de categoria cortada aparece como Todos", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => row(`p${i}`, { category_id: "c1" })),
      row("p9", { category_id: "c2" }),
    ];
    const result = resolveCatalog(storeRow, rows, categorias, "free");
    if (result.status !== "ok") throw new Error("esperava status ok");

    expect(result.store.categories).toEqual(["Todos", "Vestidos"]);
    expect(result.products.every((p) => p.category !== "Blusas")).toBe(true);
  });
});
