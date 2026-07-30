import { describe, it, expect } from "vitest";
import { applyPlanVisibility } from "@/lib/plan-visibility";
import { getPlanLimits } from "@/lib/plan-limits";
import type { PublicProductRow, PublicCategoryRow } from "@/lib/catalog";

function produto(over: Partial<PublicProductRow> & { id: string }): PublicProductRow {
  return {
    name: `Produto ${over.id}`,
    price_cents: 1000,
    description: null,
    category_id: null,
    sizes: null,
    sold_sizes: null,
    colors: null,
    images: ["a.jpg"],
    stock: 5,
    is_active: true,
    is_new: false,
    is_featured: false,
    ...over,
  };
}

const cats: PublicCategoryRow[] = [
  { id: "c1", name: "Vestidos", position: 1 },
  { id: "c2", name: "Blusas", position: 2 },
];

const free = getPlanLimits("free", null);
const starter = getPlanLimits("starter", null);
const pro = getPlanLimits("pro", null);

describe("applyPlanVisibility — produtos", () => {
  it("corta no maxProducts preservando a ordem de entrada", () => {
    const rows = Array.from({ length: 12 }, (_, i) => produto({ id: `p${i}` }));
    const { products } = applyPlanVisibility(rows, [], free);
    expect(products).toHaveLength(8);
    expect(products.map((p) => p.id)).toEqual([
      "p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7",
    ]);
  });

  it("Pro (Infinity) devolve todos os produtos", () => {
    const rows = Array.from({ length: 300 }, (_, i) => produto({ id: `p${i}` }));
    const { products } = applyPlanVisibility(rows, [], pro);
    expect(products).toHaveLength(300);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(applyPlanVisibility([], [], free)).toEqual({ products: [], categories: [] });
  });
});

describe("applyPlanVisibility — fotos", () => {
  it("corta a galeria no maxPhotos e preserva a capa", () => {
    const rows = [produto({ id: "p1", images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"] })];
    const { products } = applyPlanVisibility(rows, [], free);
    expect(products[0].images).toEqual(["1.jpg"]);
  });

  it("images nula continua nula", () => {
    const rows = [produto({ id: "p1", images: null })];
    const { products } = applyPlanVisibility(rows, [], starter);
    expect(products[0].images).toBeNull();
  });
});

describe("applyPlanVisibility — destaques", () => {
  it("mantém só os primeiros maxFeaturedProducts em destaque", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      produto({ id: `p${i}`, is_featured: true })
    );
    const { products } = applyPlanVisibility(rows, [], starter);
    expect(products.filter((p) => p.is_featured).map((p) => p.id)).toEqual([
      "p0", "p1", "p2",
    ]);
  });

  it("Free zera todos os destaques", () => {
    const rows = [produto({ id: "p1", is_featured: true })];
    const { products } = applyPlanVisibility(rows, [], free);
    expect(products[0].is_featured).toBe(false);
  });

  it("Pro mantém destaques ilimitados", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      produto({ id: `p${i}`, is_featured: true })
    );
    const { products } = applyPlanVisibility(rows, [], pro);
    expect(products.every((p) => p.is_featured)).toBe(true);
  });
});

describe("applyPlanVisibility — categorias", () => {
  it("só devolve categorias que têm produto visível", () => {
    const rows = [produto({ id: "p1", category_id: "c1" })];
    const { categories } = applyPlanVisibility(rows, cats, starter);
    expect(categories.map((c) => c.id)).toEqual(["c1"]);
  });

  it("ignora categoria cujos produtos foram cortados pelo limite", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => produto({ id: `p${i}`, category_id: "c1" })),
      produto({ id: "p9", category_id: "c2" }),
    ];
    const { categories } = applyPlanVisibility(rows, cats, free);
    expect(categories.map((c) => c.id)).toEqual(["c1"]);
  });

  it("corta no maxCategories respeitando position", () => {
    const rows = [
      produto({ id: "p1", category_id: "c1" }),
      produto({ id: "p2", category_id: "c2" }),
    ];
    const { categories } = applyPlanVisibility(rows, cats, free);
    expect(categories.map((c) => c.id)).toEqual(["c1"]);
  });

  it("produto de categoria cortada perde o vínculo (cai em Todos)", () => {
    const rows = [
      produto({ id: "p1", category_id: "c1" }),
      produto({ id: "p2", category_id: "c2" }),
    ];
    const { products } = applyPlanVisibility(rows, cats, free);
    expect(products.find((p) => p.id === "p1")?.category_id).toBe("c1");
    expect(products.find((p) => p.id === "p2")?.category_id).toBeNull();
  });
});

describe("applyPlanVisibility — pureza", () => {
  it("não muta a entrada", () => {
    const rows = [produto({ id: "p1", images: ["1.jpg", "2.jpg"], is_featured: true })];
    const copia = structuredClone(rows);
    applyPlanVisibility(rows, cats, free);
    expect(rows).toEqual(copia);
  });
});
