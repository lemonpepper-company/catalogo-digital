import type { Product, Store } from "./types";

export const STORE: Store = {
  name: "Ateliê Mira",
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos", "Vestidos", "Blusas", "Calças", "Saias"],
  description: "Vitrine digital premium · moda feminina autoral",
  accentColor: "#C9A96E",
  catalogUrl: "catalogo.app/ateliemira",
};

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Vestido midi linho areia",
    price: "R$ 289,90",
    category: "Vestidos",
    isNew: true,
    image:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=700&q=80&auto=format&fit=crop",
    desc: "Vestido midi em linho puro com caimento fluido, alças ajustáveis e botões de madeira na frente. Peça única, produção artesanal em pequena escala.",
    sizes: ["P", "M", "G", "GG"],
    soldSizes: ["GG"],
    colors: [
      { label: "Areia", hex: "#D8C9B0" },
      { label: "Argila", hex: "#B07A5B" },
      { label: "Preto", hex: "#1A1A1A" },
    ],
    stock: 12,
    active: true,
  },
  {
    id: "p2",
    name: "Blusa de tricô off-white",
    price: "R$ 169,90",
    category: "Blusas",
    image:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=700&q=80&auto=format&fit=crop",
    desc: "Tricô leve de algodão com gola redonda e mangas longas. Toque macio e caimento soltinho para usar em qualquer estação.",
    sizes: ["PP", "P", "M", "G"],
    soldSizes: [],
    colors: [
      { label: "Off-white", hex: "#EFEBE2" },
      { label: "Caramelo", hex: "#A9712F" },
    ],
    stock: 7,
    active: true,
  },
  {
    id: "p3",
    name: "Calça pantalona alfaiataria",
    price: "R$ 249,90",
    category: "Calças",
    isNew: true,
    image:
      "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=700&q=80&auto=format&fit=crop",
    desc: "Pantalona de alfaiataria com cintura alta e pregas frontais. Tecido encorpado com leve elasticidade.",
    sizes: ["36", "38", "40", "42", "44"],
    soldSizes: ["36"],
    colors: [
      { label: "Preto", hex: "#1A1A1A" },
      { label: "Areia", hex: "#D8C9B0" },
    ],
    stock: 24,
    active: true,
  },
  {
    id: "p4",
    name: "Vestido slip acetinado",
    price: "R$ 219,90",
    category: "Vestidos",
    soldOut: true,
    image:
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=700&q=80&auto=format&fit=crop",
    desc: "Slip dress em cetim com viés nas alças e fenda lateral discreta.",
    sizes: ["P", "M", "G"],
    soldSizes: ["P", "M", "G"],
    colors: [{ label: "Vinho", hex: "#5B2433" }],
    stock: 0,
    active: true,
  },
  {
    id: "p5",
    name: "Saia midi plissada",
    price: "R$ 159,90",
    category: "Saias",
    image:
      "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=700&q=80&auto=format&fit=crop",
    desc: "Saia midi plissada com cós elástico confortável e movimento leve ao caminhar.",
    sizes: ["Único"],
    soldSizes: [],
    colors: [
      { label: "Areia", hex: "#D8C9B0" },
      { label: "Verde musgo", hex: "#5A6048" },
    ],
    stock: 31,
    active: true,
  },
  {
    id: "p6",
    name: "Blusa cropped canelado",
    price: "R$ 89,90",
    category: "Blusas",
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=700&q=80&auto=format&fit=crop",
    desc: "Cropped canelado de manga curta com modelagem ajustada ao corpo.",
    sizes: ["PP", "P", "M"],
    soldSizes: ["PP"],
    colors: [
      { label: "Preto", hex: "#1A1A1A" },
      { label: "Off-white", hex: "#EFEBE2" },
      { label: "Caramelo", hex: "#A9712F" },
    ],
    stock: 5,
    active: false,
  },
  {
    id: "p7",
    name: "Vestido chemise xadrez",
    price: "R$ 239,90",
    category: "Vestidos",
    image:
      "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=700&q=80&auto=format&fit=crop",
    desc: "Chemise de manga longa com cinto de amarração na cintura e padronagem xadrez discreta.",
    sizes: ["P", "M", "G", "GG"],
    soldSizes: [],
    colors: [{ label: "Xadrez areia", hex: "#C8B79A" }],
    stock: 18,
    active: true,
  },
  {
    id: "p8",
    name: "Calça wide leg jeans",
    price: "R$ 199,90",
    category: "Calças",
    soldOut: true,
    image:
      "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=700&q=80&auto=format&fit=crop",
    desc: "Jeans wide leg de cintura alta com lavagem clara e barra a fio.",
    sizes: ["36", "38", "40"],
    soldSizes: ["36", "38", "40"],
    colors: [{ label: "Jeans claro", hex: "#A7B4C4" }],
    stock: 0,
    active: true,
  },
];

export const ACCENT_COLOR_OPTIONS = [
  "#C9A96E",
  "#0D0D0D",
  "#5B2433",
  "#5A6048",
  "#2A5C8A",
  "#A9712F",
];

export const FASHION_COLORS = [
  { name: "Preto", hex: "#1A1A1A" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Cinza", hex: "#8E8E8E" },
  { name: "Bege", hex: "#D8C9B0" },
  { name: "Caramelo", hex: "#A9712F" },
  { name: "Vermelho", hex: "#C0392B" },
  { name: "Rosa", hex: "#E59AB0" },
  { name: "Roxo", hex: "#7A4E9E" },
  { name: "Azul marinho", hex: "#1F2D5A" },
  { name: "Azul claro", hex: "#8FB8DE" },
  { name: "Verde", hex: "#5A7A4E" },
  { name: "Laranja", hex: "#E07B3C" },
  { name: "Amarelo", hex: "#E6C24E" },
  { name: "Dourado", hex: "#C9A96E" },
  { name: "Prata", hex: "#C5C7CA" },
  { name: "Bordô", hex: "#5B2433" },
];

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
