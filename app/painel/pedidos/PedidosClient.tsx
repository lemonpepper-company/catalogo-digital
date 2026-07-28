"use client";

import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { formatCents, formatDeliveryLine, formatPaymentLine } from "@/lib/utils";
import type { OrderStatus } from "@/lib/orders";
import type { StoreOrder, StoreOrderItem } from "@/lib/types";
import { usePedidos } from "./use-pedidos";

interface PedidosClientProps {
  orders: StoreOrder[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

const STATUS_TONES: Record<OrderStatus, "soldout" | "success" | "error"> = {
  pendente: "soldout",
  confirmado: "success",
  cancelado: "error",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatOrderDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

function variationLabel(item: StoreOrderItem): string {
  const parts: string[] = [];
  if (item.size) parts.push(`Tamanho ${item.size}`);
  if (item.color) parts.push(`Cor ${item.color}`);
  return parts.join(" · ");
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PedidosClient({ orders, total, page, totalPages }: PedidosClientProps) {
  const { selected, openOrder, closeOrder } = usePedidos(orders);

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div>
        <h1 className="font-display font-semibold text-[28px] text-obsidian">Pedidos</h1>
        <p className="font-body text-[15px] text-graphite mt-1.5">
          {total === 0
            ? "Os pedidos enviados pela sacola aparecem aqui."
            : `${total} ${total === 1 ? "pedido recebido" : "pedidos recebidos"}`}
        </p>
      </div>

      {orders.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
              <Receipt size={42} />
            </div>
            <div>
              <div className="font-display font-semibold text-[20px] text-obsidian">
                Nenhum pedido ainda
              </div>
              <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                Quando um cliente enviar a sacola pelo WhatsApp, o pedido aparece aqui
                com os itens e o total.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <Card pad={0} className="overflow-hidden">
            {orders.map((order, i) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openOrder(order.id)}
                aria-label={`Ver detalhe do pedido de ${order.customerName ?? "Sem nome"}`}
                className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-linen/50 transition-colors"
                style={{ borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-display font-medium text-[15px] text-obsidian truncate">
                    {order.customerName ?? "Sem nome"}
                  </div>
                  <div className="font-body text-[13px] text-graphite mt-0.5">
                    {formatOrderDate(order.createdAt)} · {itemsLabel(order.itemsCount)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="font-display font-medium text-[15px] text-obsidian">
                    {formatCents(order.totalCents)}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </button>
            ))}
          </Card>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/painel/pedidos"
          />
        </>
      )}

      {selected && (
        <Modal title="Detalhe do pedido" onClose={closeOrder} className="max-w-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display font-medium text-[16px] text-obsidian">
                {selected.customerName ?? "Sem nome"}
              </div>
              <div className="font-body text-[13px] text-graphite mt-0.5">
                {formatOrderDate(selected.createdAt)}
              </div>
            </div>
            <OrderStatusBadge status={selected.status} />
          </div>

          <div className="flex flex-col">
            {selected.items.map((item, i) => {
              const variation = variationLabel(item);
              return (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 py-3"
                  style={{
                    borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-body text-[14px] text-obsidian">
                      {item.productName}
                    </div>
                    {variation && (
                      <div className="font-body text-[13px] text-graphite mt-0.5">
                        {variation}
                      </div>
                    )}
                    <div className="font-body text-[13px] text-graphite mt-0.5">
                      {item.qty}x {formatCents(item.unitPriceCents)}
                    </div>
                  </div>
                  <span className="font-body font-medium text-[14px] text-obsidian flex-shrink-0">
                    {formatCents(item.unitPriceCents * item.qty)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1">
            {formatPaymentLine(selected.paymentMethod) && (
              <p className="font-body text-[14px] text-graphite">
                {formatPaymentLine(selected.paymentMethod)}
              </p>
            )}
            {formatDeliveryLine(selected.deliveryMethod, selected.deliveryAddress) && (
              <p className="font-body text-[14px] text-graphite">
                {formatDeliveryLine(selected.deliveryMethod, selected.deliveryAddress)}
              </p>
            )}
          </div>

          <div
            className="flex items-center justify-between pt-4"
            style={{ borderTop: "0.5px solid var(--color-border)" }}
          >
            <span className="font-body text-[14px] text-graphite">Total</span>
            <span className="font-display font-semibold text-[20px] text-obsidian">
              {formatCents(selected.totalCents)}
            </span>
          </div>
        </Modal>
      )}
    </div>
  );
}
