"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  metrics: OrderMetrics | null;
  periodo?: string;
  de?: string;
  ate?: string;
}

export function DashboardClient({
  products,
  storeName,
  metrics,
  periodo,
  de,
  ate,
}: DashboardClientProps) {
  const { activeProducts, soldOutProducts, total, orderStats } = useDashboard(
    products,
    metrics
  );
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
          <div className="flex flex-col gap-3.5">
            <PeriodoFiltro
              basePath="/painel"
              periodo={periodo}
              de={de}
              ate={ate}
              isPending={isPending}
              startTransition={startTransition}
            />
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
          </div>
        ) : (
          <RecursoBloqueado
            titulo="Pedidos e faturamento do mês"
            descricao="Seus pedidos já estão sendo registrados. Faça upgrade para ver quantos pedidos e quanto em vendas a sua vitrine gerou."
          />
        )}
      </div>
    </div>
  );
}
