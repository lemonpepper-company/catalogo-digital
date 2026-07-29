"use client";

import { useActionState, useState } from "react";
import { updateOrderStatus, type OrderStatusState } from "@/app/actions/pedidos";
import type { StoreOrder, ToastState } from "@/lib/types";

/**
 * Guarda apenas o id do pedido aberto e resolve o objeto na lista atual — assim
 * o detalhe acompanha a lista revalidada em vez de exibir um snapshot velho.
 */
export function usePedidos(orders: StoreOrder[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const [, statusAction, statusPending] = useActionState<OrderStatusState, FormData>(
    async (prev, formData) => {
      const res = await updateOrderStatus(prev, formData);
      if (res && "ok" in res) flash("Status atualizado");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  const selected = orders.find((order) => order.id === selectedId) ?? null;

  return {
    selected,
    openOrder: (id: string) => setSelectedId(id),
    closeOrder: () => setSelectedId(null),
    toast,
    statusAction,
    statusPending,
  };
}
