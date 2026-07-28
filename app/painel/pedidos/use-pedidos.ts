"use client";

import { useState } from "react";
import type { StoreOrder } from "@/lib/types";

/**
 * Guarda apenas o id do pedido aberto e resolve o objeto na lista atual — assim
 * o detalhe acompanha a lista revalidada em vez de exibir um snapshot velho.
 */
export function usePedidos(orders: StoreOrder[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  return {
    selected,
    openOrder: (id: string) => setSelectedId(id),
    closeOrder: () => setSelectedId(null),
  };
}
