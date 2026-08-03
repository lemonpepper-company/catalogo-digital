"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { AnalyticsState } from "@/lib/server/analytics";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  metrics: OrderMetrics | null;
  /** Métricas da vitrine: números, bloqueio de plano ou indisponibilidade. */
  analytics: AnalyticsState;
  periodo?: string;
  de?: string;
  ate?: string;
}

export function DashboardClient({
  products,
  storeName,
  metrics,
  analytics,
  periodo,
  de,
  ate,
}: DashboardClientProps) {
  const {
    activeProducts,
    soldOutProducts,
    total,
    orderStats,
    catalogStats,
    topViewed,
    analyticsBloqueado,
  } = useDashboard(products, metrics, analytics);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div>
        <h1 className="font-display font-semibold text-[28px] text-obsidian">
          Olá, {storeName}
        </h1>
        <p className="font-body text-[15px] text-graphite mt-1.5">
          Aqui está um resumo da sua loja hoje.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard value={activeProducts.length} label="Produtos ativos" />
        <StatCard
          value={soldOutProducts.length}
          label="Produtos esgotados"
          tone="soldout"
        />
        <StatCard value={total} label="Produtos no catálogo" />
      </div>

      {/* Um filtro só governa as duas seções abaixo — pedidos e vitrine sempre
          mostram o mesmo período (ANL-14/ANL-15). Segue oculto no estado
          bloqueado, onde não há número nenhum para filtrar (ORD-29). */}
      {orderStats && (
        <PeriodoFiltro
          basePath="/painel"
          periodo={periodo}
          de={de}
          ate={ate}
          isPending={isPending}
          startTransition={startTransition}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="font-display font-medium text-[18px] text-obsidian">
            Vendas pela vitrine
          </h2>
          <Link
            href="/painel/pedidos"
            className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
          >
            Ver pedidos
          </Link>
        </div>
        {orderStats ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {orderStats.map((stat) => (
              <StatCard
                key={stat.label}
                value={stat.value}
                label={stat.label}
                loading={isPending}
              />
            ))}
          </div>
        ) : (
          <RecursoBloqueado
            titulo="Pedidos e faturamento do mês"
            descricao="Seus pedidos já estão sendo registrados. Faça upgrade para ver quantos pedidos e quanto em vendas a sua vitrine gerou."
          />
        )}
      </div>

      <div>
        <h2 className="font-display font-medium text-[18px] text-obsidian mb-3.5">
          Sua vitrine em números
        </h2>
        {catalogStats ? (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {catalogStats.map((stat) => (
                <StatCard
                  key={stat.label}
                  value={stat.value}
                  label={stat.label}
                  loading={isPending}
                />
              ))}
            </div>

            <div>
              <h3 className="font-body font-medium text-[15px] text-obsidian mb-2">
                Mais vistos no período
              </h3>
              {topViewed.length > 0 ? (
                <ul className="flex flex-col divide-y divide-mist rounded-card border border-mist bg-white">
                  {topViewed.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="font-body text-[14px] text-obsidian truncate">
                        {item.name}
                      </span>
                      <span className="font-body text-[13px] text-graphite whitespace-nowrap">
                        {item.views} {item.views === 1 ? "visualização" : "visualizações"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-body text-[14px] text-graphite">
                  Nenhum produto foi visto neste período.
                </p>
              )}
            </div>
          </div>
        ) : analyticsBloqueado ? (
          <RecursoBloqueado
            planoMinimo="pro"
            titulo="Visitas e produtos mais vistos"
            descricao="Veja quantas pessoas visitam sua vitrine, o que elas mais olham e quanto disso vira pedido."
          />
        ) : (
          <p className="font-body text-[14px] text-graphite">
            Não foi possível carregar agora.
          </p>
        )}
      </div>
    </div>
  );
}
