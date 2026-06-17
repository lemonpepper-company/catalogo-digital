"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { formatCents } from "@/lib/utils";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  catalogUrl: string;
}

export function DashboardClient({
  products,
  storeName,
  catalogUrl,
}: DashboardClientProps) {
  const { copied, toast, handleCopy, activeProducts, soldOutProducts, recent, total } =
    useDashboard(products, catalogUrl);

  return (
    <div className="flex flex-col gap-6 max-w-content">
      <div className="flex items-end justify-between gap-4">
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
          className="inline-flex items-center gap-2 h-11 px-6 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
        >
          <Plus size={18} />
          Cadastrar produto
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard value={activeProducts.length} label="Produtos ativos" />
        <StatCard
          value={soldOutProducts.length}
          label="Produtos esgotados"
          tone="soldout"
        />
        <StatCard value={total} label="Produtos no catálogo" />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Link do catálogo
            </div>
            <div className="font-display font-medium text-[18px] text-obsidian mt-1.5">
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

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="font-display font-medium text-[18px] text-obsidian">
            Produtos recentes
          </h2>
          <Link
            href="/painel/produtos"
            className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
          >
            Ver todos
          </Link>
        </div>
        <Card pad={0} className="overflow-hidden">
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center font-body text-[15px] text-graphite">
              Nenhum produto cadastrado ainda.
            </div>
          ) : (
            recent.map((p, i) => (
              <Link
                key={p.id}
                href={`/painel/produtos/${p.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-linen/50 transition-colors"
                style={{ borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none" }}
              >
                <div className="relative w-12 h-12 rounded-[8px] overflow-hidden bg-linen flex-shrink-0">
                  {p.images[0] && (
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-medium text-[15px] text-obsidian truncate">
                    {p.name}
                  </div>
                  <div className="font-body text-[13px] text-graphite mt-0.5">
                    {formatCents(p.priceCents)}
                  </div>
                </div>
                {p.stock === 0 ? (
                  <span className="inline-flex h-[22px] items-center px-2.5 rounded-pill bg-soldout text-white font-body font-medium text-[11px] tracking-[0.06em] uppercase">
                    Esgotado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-body text-[13px] text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    Ativo
                  </span>
                )}
              </Link>
            ))
          )}
        </Card>
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}
