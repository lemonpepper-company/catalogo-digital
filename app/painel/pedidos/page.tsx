import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { getStoreOrders } from "@/lib/server/pedidos";
import { resolvePeriodRange } from "@/lib/period-filter";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PedidosClient } from "./PedidosClient";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    periodo?: string;
    de?: string;
    ate?: string;
  }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  // Gate antes de qualquer I/O: no plano Free nenhum dado do histórico chega
  // ao HTML (ORD-28).
  if (!getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory) {
    return (
      <RecursoBloqueado
        titulo="Histórico de pedidos"
        descricao="Cada pedido enviado pela sacola já está sendo registrado. Faça upgrade para ver o histórico completo, com itens, total e status de cada venda."
      />
    );
  }

  const { page: pageParam, q, periodo, de, ate } = await searchParams;
  const query = q ?? "";
  const range = resolvePeriodRange({ periodo, de, ate });
  const { orders, total, page, totalPages } = await getStoreOrders(
    store.id,
    Number(pageParam ?? "1"),
    query,
    range
  );

  return (
    <PedidosClient
      orders={orders}
      total={total}
      page={page}
      totalPages={totalPages}
      query={query}
      periodo={periodo}
      de={de}
      ate={ate}
    />
  );
}
