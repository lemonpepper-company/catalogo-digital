"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn, formatCents } from "@/lib/utils";
import type { StoreProduct } from "@/lib/types";
import { useProdutos } from "./use-produtos";
import { useProdutosFiltros } from "./use-produtos-filtros";
import { Pagination } from "@/components/ui/Pagination";
import type { ProductCounts } from "./use-produtos";
import { NO_CATEGORY_VALUE, STATUS_OPTIONS } from "@/lib/product-filters";

interface ProdutosClientProps {
  products: StoreProduct[];
  maxProducts: number;
  counts: ProductCounts;
  page: number;
  totalPages: number;
  categories: { id: string; name: string }[];
  initialQ: string;
  initialCategoria: string;
  initialStatus: string;
}

export function ProdutosClient({
  products,
  maxProducts,
  counts,
  page,
  totalPages,
  categories,
  initialQ,
  initialCategoria,
  initialStatus,
}: ProdutosClientProps) {
  const {
    confirm,
    setConfirm,
    toast,
    active,
    soldOut,
    inactive,
    limitReached,
    isPending,
    toggleActive,
    removeProduct,
  } = useProdutos(products, maxProducts, counts, page, {
    q: initialQ,
    categoria: initialCategoria,
    status: initialStatus,
  });

  const { q, onQChange, onCategoriaChange, onStatusChange, clearFilters } =
    useProdutosFiltros(initialQ, initialCategoria, initialStatus);

  const isStoreEmpty = counts.total === 0;
  const hasActiveFilters = Boolean(
    initialQ || initialCategoria || initialStatus
  );

  const categoriaLabel =
    initialCategoria === NO_CATEGORY_VALUE
      ? "Sem categoria"
      : categories.find((c) => c.id === initialCategoria)?.name ?? "";

  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === initialStatus)?.label ?? "";

  const extraParams: Record<string, string> = {};
  if (initialQ) extraParams.q = initialQ;
  if (initialCategoria) extraParams.categoria = initialCategoria;
  if (initialStatus) extraParams.status = initialStatus;

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Produtos
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            {counts.total}{" "}
            {counts.total === 1 ? "produto cadastrado" : "produtos cadastrados"}
            {Number.isFinite(maxProducts) ? ` · limite ${maxProducts}` : ""}
          </p>
        </div>
        {limitReached ? (
          <span className="inline-flex items-center justify-center min-h-11 px-6 py-2.5 rounded-btn bg-linen text-graphite font-display font-medium text-[15px] cursor-not-allowed text-center">
            Limite atingido — faça upgrade
          </span>
        ) : (
          <Link
            href="/painel/produtos/novo"
            className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
          >
            <Plus size={18} />
            Novo produto
          </Link>
        )}
      </div>

      {isStoreEmpty ? (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
              <Package size={42} />
            </div>
            <div>
              <div className="font-display font-semibold text-[20px] text-obsidian">
                Nenhum produto cadastrado ainda
              </div>
              <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                Cadastre sua primeira peça e ela aparece no catálogo público na hora.
              </p>
            </div>
            <Link
              href="/painel/produtos/novo"
              className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-btn bg-gold text-white font-display font-medium text-[15px] hover:bg-gold-hover transition-colors"
            >
              <Plus size={18} />
              Cadastrar primeiro produto →
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="bg-linen">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10">
              {[
                { value: active, label: "ativos", color: "bg-success" },
                { value: soldOut, label: "esgotados", color: "bg-soldout" },
                { value: inactive, label: "inativos", color: "bg-inactive" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
                  <span className="font-display font-semibold text-[20px] text-obsidian">
                    {s.value}
                  </span>
                  <span className="font-body text-[14px] text-graphite">{s.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite pointer-events-none z-10"
              />
              <Input
                value={q}
                onChange={(e) => onQChange(e.target.value)}
                placeholder="Buscar por nome..."
                aria-label="Buscar por nome"
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <Select
                value={categoriaLabel || "Todas as categorias"}
                options={[
                  "Todas as categorias",
                  ...categories.map((c) => c.name),
                  "Sem categoria",
                ]}
                onChange={(label) => {
                  if (label === "Todas as categorias") onCategoriaChange("");
                  else if (label === "Sem categoria")
                    onCategoriaChange(NO_CATEGORY_VALUE);
                  else {
                    const found = categories.find((c) => c.name === label);
                    onCategoriaChange(found ? found.id : "");
                  }
                }}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select
                value={statusLabel || "Todos os status"}
                options={["Todos os status", ...STATUS_OPTIONS.map((o) => o.label)]}
                onChange={(label) => {
                  if (label === "Todos os status") onStatusChange("");
                  else {
                    const found = STATUS_OPTIONS.find((o) => o.label === label);
                    onStatusChange(found ? found.value : "");
                  }
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
            >
              Limpar filtros
            </Button>
          </div>

          {products.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
                  <Search size={42} />
                </div>
                <div>
                  <div className="font-display font-semibold text-[20px] text-obsidian">
                    Nenhum produto encontrado
                  </div>
                  <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                    Tente ajustar sua busca ou filtro.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <Card pad={0} className="overflow-hidden">
                <div className="hidden lg:flex items-center gap-4 px-5 py-3 bg-linen">
                  <span className="flex-1 font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                    Produto
                  </span>
                  <span className="w-[120px] flex-shrink-0 text-right font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                    Estoque
                  </span>
                  <span className="w-[140px] flex-shrink-0 font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                    Visibilidade
                  </span>
                  <span className="w-[76px] flex-shrink-0" />
                </div>

                {products.map((p, i) => {
                  const isSoldOut = p.stock === 0;
                  const stockTone =
                    isSoldOut || p.stock <= 5
                      ? "text-soldout font-semibold"
                      : "text-graphite";
                  return (
                    <div
                      key={p.id}
                      style={{
                        borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                      }}
                    >
                      {/* Card mobile (abaixo de lg:) */}
                      <div className="lg:hidden flex flex-col gap-3 px-5 py-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <ProductThumbnail
                            src={p.images[0]}
                            alt={p.name}
                            active={p.isActive}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-medium text-[15px] text-obsidian truncate">
                              {p.name}
                            </div>
                            <div className="font-body text-[13px] text-graphite mt-0.5">
                              {formatCents(p.priceCents)}
                            </div>
                          </div>
                          <ProductActions
                            editHref={`/painel/produtos/${p.id}`}
                            onDelete={() => setConfirm(p)}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 pl-[68px]">
                          <StockLabel stock={p.stock} tone={stockTone} />
                          <VisibilityToggle
                            active={p.isActive}
                            onToggle={() => toggleActive(p)}
                          />
                        </div>
                      </div>

                      {/* Linha desktop (lg: e acima) */}
                      <div className="hidden lg:flex items-center gap-4 px-5 py-3.5">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <ProductThumbnail
                            src={p.images[0]}
                            alt={p.name}
                            active={p.isActive}
                          />
                          <div className="min-w-0">
                            <div className="font-display font-medium text-[15px] text-obsidian truncate">
                              {p.name}
                            </div>
                            <div className="font-body text-[13px] text-graphite mt-0.5">
                              {formatCents(p.priceCents)}
                            </div>
                          </div>
                        </div>

                        <div className="w-[120px] flex-shrink-0 text-right">
                          <StockLabel stock={p.stock} tone={stockTone} />
                        </div>

                        <div className="w-[140px] flex-shrink-0">
                          <VisibilityToggle
                            active={p.isActive}
                            onToggle={() => toggleActive(p)}
                          />
                        </div>

                        <div className="w-[76px] flex-shrink-0">
                          <ProductActions
                            editHref={`/painel/produtos/${p.id}`}
                            onDelete={() => setConfirm(p)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                basePath="/painel/produtos"
                extraParams={extraParams}
              />
            </>
          )}
        </>
      )}

      {confirm && (
        <Modal title="Excluir produto" onClose={() => setConfirm(null)}>
          <p className="font-body text-[15px] text-graphite leading-relaxed">
            Tem certeza que deseja excluir{" "}
            <strong className="text-obsidian font-semibold">{confirm.name}</strong>?
            Essa ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              iconLeft={<Trash2 size={18} />}
              disabled={isPending}
              onClick={() => removeProduct(confirm.id)}
            >
              {isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}

function ProductThumbnail({
  src,
  alt,
  active,
}: {
  src: string | undefined;
  alt: string;
  active: boolean;
}) {
  return (
    <div
      className="relative w-[52px] h-16 rounded-[8px] overflow-hidden bg-linen flex-shrink-0"
      style={{ opacity: active ? 1 : 0.5 }}
    >
      {src && (
        <Image src={src} alt={alt} fill sizes="52px" className="object-cover" />
      )}
    </div>
  );
}

function StockLabel({ stock, tone }: { stock: number; tone: string }) {
  return (
    <span className={cn("font-body text-[13px]", tone)}>
      {stock === 0 ? "Esgotado" : `${stock} em estoque`}
    </span>
  );
}

function VisibilityToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Switch checked={active} onChange={onToggle} />
      <span
        className={cn(
          "font-body text-[13px]",
          active ? "text-success" : "text-inactive"
        )}
      >
        {active ? "Ativo" : "Inativo"}
      </span>
    </div>
  );
}

function ProductActions({
  editHref,
  onDelete,
}: {
  editHref: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1 flex-shrink-0">
      <Link
        href={editHref}
        aria-label="Editar"
        className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-obsidian flex items-center justify-center hover:bg-surface-hover transition-colors"
      >
        <Pencil size={15} />
      </Link>
      <button
        onClick={onDelete}
        aria-label="Excluir"
        className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-error flex items-center justify-center hover:bg-error-surface transition-colors"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
