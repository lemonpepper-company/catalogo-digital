export interface ProductColor {
  label: string;
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  price: string;
  category: string;
  image: string;
  desc: string;
  sizes: string[];
  soldSizes: string[];
  colors: ProductColor[];
  isNew?: boolean;
  soldOut?: boolean;
  stock?: number;
  active?: boolean;
}

export interface Store {
  name: string;
  monogram: string;
  whatsapp: string;
  categories: string[];
  description: string;
  accentColor: string;
  catalogUrl: string;
  analyticsId?: string;
  pixelId?: string;
}

export interface CartItem {
  key: string;
  product: Product;
  size: string | null;
  color: string | null;
  qty: number;
}

export type ToastTone = "success" | "error";

export interface ToastState {
  msg: string;
  tone: ToastTone;
}

export type PainelRoute =
  | "dashboard"
  | "produtos"
  | "cadastro"
  | "categorias"
  | "configuracoes";
