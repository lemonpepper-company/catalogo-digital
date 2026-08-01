import type { Plan } from "./plan-limits";
import type { OrderStatus } from "./orders";
import type { ResolvedTheme } from "@/lib/theme-options";

export type { Plan };

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
  images?: string[];
  desc: string;
  sizes: string[];
  soldSizes: string[];
  colors: ProductColor[];
  isNew?: boolean;
  isFeatured: boolean;
  soldOut?: boolean;
  stock?: number;
  active?: boolean;
}

export interface Store {
  name: string;
  slug: string;
  monogram: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  whatsapp: string;
  instagram?: string;
  categories: string[];
  description: string;
  accentColor: string;
  catalogUrl: string;
  analyticsId?: string;
  pixelId?: string;
  messageTemplate?: string | null;
  paymentMethods?: string[];
  deliveryMethods?: string[];
  theme: ResolvedTheme;
  gridDensity: "padrao" | "compacto";
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
  | "pedidos"
  | "cadastro"
  | "categorias"
  | "configuracoes";

export interface StoreProduct {
  id: string;
  name: string;
  priceCents: number;
  description: string | null;
  categoryId: string | null;
  sizes: string[];
  soldSizes: string[];
  colors: ProductColor[];
  images: string[];
  stock: number;
  isActive: boolean;
  isNew: boolean;
  isFeatured: boolean;
}

export interface StoreOrderItem {
  productName: string;
  unitPriceCents: number;
  qty: number;
  size: string | null;
  color: string | null;
}

export interface StoreOrder {
  id: string;
  code: string;
  createdAt: string;
  customerName: string | null;
  paymentMethod: string | null;
  deliveryMethod: string | null;
  deliveryAddress: string | null;
  itemsCount: number;
  totalCents: number;
  status: OrderStatus;
  items: StoreOrderItem[];
}

export interface StoreCategory {
  id: string;
  name: string;
  position: number;
  productCount: number;
}

export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  planExpiresAt: string | null;
  whatsapp: string | null;
  accentColor: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  monogram: string | null;
  analyticsId: string | null;
  pixelId: string | null;
  messageTemplate: string | null;
  instagram: string | null;
  paymentMethods: string[];
  deliveryMethods: string[];
  customDomain: string | null;
  customDomainVerified: boolean;
  fontPairing: string;
  backgroundPalette: string;
  cornerStyle: string;
  secondaryColor: string | null;
  gridDensity: "padrao" | "compacto";
}
