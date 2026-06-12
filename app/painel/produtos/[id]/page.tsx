import { PRODUCTS } from "@/lib/data";
import { ProdutoFormClient } from "../ProdutoFormClient";

interface Props {
  params: { id: string };
}

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export default function EditarProdutoPage({ params }: Props) {
  const product = PRODUCTS.find((p) => p.id === params.id);
  return <ProdutoFormClient product={product} />;
}
