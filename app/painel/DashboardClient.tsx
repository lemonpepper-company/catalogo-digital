"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Plus, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  catalogUrl: string;
  metrics: OrderMetrics | null;
  periodo?: string;
  de?: string;
  ate?: string;
}

export function DashboardClient({
  products,
  storeName,
  catalogUrl,
  metrics,
  periodo,
  de,
  ate,
}: DashboardClientProps) {
  const { copied, toast, handleCopy, activeProducts, soldOutProducts, total, orderStats } =
    useDashboard(products, catalogUrl, metrics);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Olá, {storeName}
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            Aqui está um resumo da sua loja hoje.
          </p>
        </div>
        <Link
          href="/painel/produtos/novo"
          className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
        >
          <Plus size={18} />
          Cadastrar produto
        </Link>
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

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Link do catálogo
            </div>
            <div className="font-display font-medium text-[18px] text-obsidian mt-1.5 break-all">
              {catalogUrl}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="ghost"
              iconLeft={<ExternalLink size={18} />}
              onClick={() => window.open(catalogUrl, "_blank")}
            >
              Abrir
            </Button>
            <Button
              variant="primary"
              onClick={handleCopy}
              iconLeft={
                copied ? <Check size={18} className="text-gold" /> : <Copy size={18} />
              }
            >
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
          </div>
        </div>
      </Card>

      {toast && <Toast msg={toast} />}
    </div>
  );
}
