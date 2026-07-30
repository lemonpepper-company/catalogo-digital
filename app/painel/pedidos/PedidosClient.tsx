"use client";

import { useTransition } from "react";
import { Receipt, Search, CalendarSearch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Toast } from "@/components/ui/Toast";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import { OrderRowSkeleton } from "@/components/painel/OrderRowSkeleton";
import { cn, formatCents, formatDeliveryLine, formatPaymentLine } from "@/lib/utils";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";
import { activePeriodToken } from "@/lib/period-filter";
import type { StoreOrder, StoreOrderItem } from "@/lib/types";
import { usePedidos } from "./use-pedidos";
import { usePedidosBusca } from "./use-pedidos-busca";

interface PedidosClientProps {
  orders: StoreOrder[];
  total: number;
  page: number;
  totalPages: number;
  query?: string;
  periodo?: string;
  de?: string;
  ate?: string;
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

function OrderCodeTag({ code }: { code: string }) {
  return (
    <span className="flex-shrink-0 font-mono text-[11px] tracking-[0.04em] text-graphite bg-linen border border-sand/60 rounded-pill px-2 py-0.5">
      {code}
    </span>
  );
}

export function PedidosClient({
  orders,
  total,
  page,
  totalPages,
  query = "",
  periodo,
  de,
  ate,
}: PedidosClientProps) {
  const { selected, openOrder, closeOrder, toast, statusAction, statusPending } =
    usePedidos(orders);
  const [filtersPending, startTransition] = useTransition();

  const periodParams: Record<string, string> = {};
  if (periodo) periodParams.periodo = periodo;
  if (de) periodParams.de = de;
  if (ate) periodParams.ate = ate;

  const { query: searchTerm, onQueryChange } = usePedidosBusca(
    query,
    startTransition,
    periodParams
  );

  const searchExtraParams: Record<string, string> = query ? { q: query } : {};
  const paginationExtraParams = { ...searchExtraParams, ...periodParams };

  const activeToken = activePeriodToken({ periodo, de, ate });
  const isSearching = query !== "";
  const isPeriodFiltered = activeToken !== "mes";
  const isFiltering = isSearching || isPeriodFiltered;
  const showSearch = isFiltering || orders.length > 0;

  const subtitle = isSearching
    ? total === 0
      ? `Nenhum pedido combina com "${query}".`
      : `${total} ${total === 1 ? "pedido encontrado" : "pedidos encontrados"}`
    : isPeriodFiltered
      ? total === 0
        ? "Nenhum pedido no período selecionado."
        : `${total} ${total === 1 ? "pedido no período" : "pedidos no período"}`
      : total === 0
        ? "Os pedidos enviados pela sacola aparecem aqui."
        : `${total} ${total === 1 ? "pedido recebido" : "pedidos recebidos"}`;

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div>
        <h1 className="font-display font-semibold text-[28px] text-obsidian">Pedidos</h1>
        <p className="font-body text-[15px] text-graphite mt-1.5">{subtitle}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {showSearch && (
          <div className="relative flex-1">
            {filtersPending ? (
              <Loader2
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite animate-spin pointer-events-none z-10"
                data-testid="busca-pedidos-loading"
              />
            ) : (
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite pointer-events-none z-10"
              />
            )}
            <Input
              value={searchTerm}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Buscar por código ou nome do cliente..."
              aria-label="Buscar por código ou nome do cliente"
              className="pl-9"
            />
          </div>
        )}
        <PeriodoFiltro
          basePath="/painel/pedidos"
          periodo={periodo}
          de={de}
          ate={ate}
          extraParams={searchExtraParams}
          isPending={filtersPending}
          startTransition={startTransition}
        />
      </div>

      {filtersPending ? (
        <Card pad={0} className="overflow-hidden">
          {Array.from({ length: orders.length || 6 }).map((_, i) => (
            <OrderRowSkeleton key={i} first={i === 0} />
          ))}
        </Card>
      ) : orders.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
              {isSearching ? (
                <Search size={42} />
              ) : isPeriodFiltered ? (
                <CalendarSearch size={42} />
              ) : (
                <Receipt size={42} />
              )}
            </div>
            {isSearching ? (
              <div>
                <div className="font-display font-semibold text-[20px] text-obsidian">
                  Nenhum pedido encontrado
                </div>
                <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                  Nenhum pedido desta loja combina com “{query}”. Tente o código que
                  chegou no WhatsApp ou parte do nome do cliente.
                </p>
              </div>
            ) : isPeriodFiltered ? (
              <div>
                <div className="font-display font-semibold text-[20px] text-obsidian">
                  Nenhum pedido no período
                </div>
                <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                  Nenhum pedido desta loja caiu no período selecionado. Tente escolher
                  outro período acima.
                </p>
              </div>
            ) : (
              <div>
                <div className="font-display font-semibold text-[20px] text-obsidian">
                  Nenhum pedido ainda
                </div>
                <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                  Quando um cliente enviar a sacola pelo WhatsApp, o pedido aparece aqui
                  com os itens e o total.
                </p>
              </div>
            )}
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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display font-medium text-[15px] text-obsidian truncate">
                      {order.customerName ?? "Sem nome"}
                    </span>
                    <OrderCodeTag code={order.code} />
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
            extraParams={paginationExtraParams}
          />
        </>
      )}

      {selected && (
        <Modal title="Detalhe do pedido" onClose={closeOrder} className="max-w-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display font-medium text-[16px] text-obsidian truncate">
                  {selected.customerName ?? "Sem nome"}
                </span>
                <OrderCodeTag code={selected.code} />
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

          <form action={statusAction} className="flex flex-col gap-2.5">
            <input type="hidden" name="id" value={selected.id} />
            <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Status da venda
            </span>
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  type="submit"
                  name="status"
                  value={status}
                  disabled={statusPending}
                  className={cn(
                    "min-h-9 px-4 rounded-pill border font-body text-[13px] transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    status === selected.status
                      ? "bg-obsidian border-obsidian text-white"
                      : "bg-transparent border-sand text-obsidian hover:bg-surface-hover"
                  )}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}
