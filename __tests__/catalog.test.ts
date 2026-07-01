import { describe, it, expect } from "vitest";
import {
  PLACEHOLDER_IMAGE,
  initialsFromName,
  mapPublicStore,
  mapPublicProduct,
  computePills,
  resolveCatalog,
  type PublicStoreRow,
  type PublicProductRow,
  type PublicCategoryRow,
} from "@/lib/catalog";

const storeRow: PublicStoreRow = {
  id: "s1",
  name: "Ateliê Mira",
  slug: "atelie-mira",
  is_active: true,
  whatsapp: "5511999990000",
  accent_color: "#C9A96E",
  logo_url: null,
  description: "Vitrine premium",
  monogram: "AM",
  analytics_id: null,
  pixel_id: null,
  message_template: null,
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
    expect(mapPublicStore({ ...storeRow, monogram: null }, []).monogram).toBe("AM");
  });
  it("mapeia whatsapp nulo para string vazia", () => {
    expect(mapPublicStore({ ...storeRow, whatsapp: null }, []).whatsapp).toBe("");
  });
  it("propaga o message_template para messageTemplate", () => {
    expect(
      mapPublicStore({ ...storeRow, message_template: "Oi {itens}" }, []).messageTemplate
    ).toBe("Oi {itens}");
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

describe("resolveCatalog — visibilidade (CAT-10, CAT-03)", () => {
  it("slug inexistente → not_found", () => {
    expect(resolveCatalog(null, [], []).status).toBe("not_found");
  });
  it("loja inativa → hidden", () => {
    const r = resolveCatalog({ ...storeRow, is_active: false }, [product({})], [catVestidos]);
    expect(r.status).toBe("hidden");
  });
  it("loja ativa → ok", () => {
    const r = resolveCatalog(storeRow, [product({})], [catVestidos]);
    expect(r.status).toBe("ok");
  });
});

describe("resolveCatalog — montagem (CAT-01, CAT-06)", () => {
  it("mapeia produtos com nome da categoria resolvido", () => {
    const r = resolveCatalog(storeRow, [product({ category_id: "c1" })], [catVestidos]);
    if (r.status !== "ok") throw new Error("esperado ok");
    expect(r.products).toHaveLength(1);
    expect(r.products[0].category).toBe("Vestidos");
    expect(r.products[0].price).toBe("R$ 289,90");
  });
  it("expõe as pills na store", () => {
    const r = resolveCatalog(storeRow, [product({ category_id: "c1" })], [catVestidos, catBlusas]);
    if (r.status !== "ok") throw new Error("esperado ok");
    expect(r.store.categories).toEqual(["Todos", "Vestidos"]);
  });
  it("loja vazia → ok com zero produtos e só 'Todos'", () => {
    const r = resolveCatalog(storeRow, [], [catVestidos]);
    if (r.status !== "ok") throw new Error("esperado ok");
    expect(r.products).toHaveLength(0);
    expect(r.store.categories).toEqual(["Todos"]);
  });
});
