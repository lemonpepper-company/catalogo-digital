"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { PRODUCTS as INITIAL_PRODUCTS } from "@/lib/data";
import type { Product, ToastState } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [confirm, setConfirm] = useState<Product | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const active = products.filter((p) => p.active && !p.soldOut).length;
  const soldOut = products.filter((p) => p.soldOut || p.stock === 0).length;
  const inactive = products.filter((p) => !p.active).length;

  const toggleActive = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    flash("Produto excluído", "error");
    setConfirm(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-content">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Produtos
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            {products.length}{" "}
            {products.length === 1 ? "produto cadastrado" : "produtos cadastrados"}
          </p>
        </div>
        <Link
          href="/painel/produtos/novo"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
        >
          <Plus size={18} />
          Novo produto
        </Link>
      </div>

      {products.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-linen flex items-center justify-center text-inactive">
              <Plus size={28} />
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
              className="inline-flex items-center gap-2 h-11 px-6 rounded-btn bg-gold text-white font-display font-medium text-[15px] hover:bg-gold-hover transition-colors"
            >
              <Plus size={18} />
              Cadastrar primeiro produto →
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <Card className="bg-linen">
            <div className="flex items-center gap-10 flex-wrap">
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
                  <span className="font-body text-[14px] text-graphite">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Table */}
          <Card pad={0} className="overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 px-5 py-3 bg-linen">
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
              const isSoldOut = p.soldOut || p.stock === 0;
              const stockTone = isSoldOut
                ? "text-soldout font-semibold"
                : (p.stock ?? 99) <= 5
                ? "text-soldout font-semibold"
                : "text-graphite";
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{
                    borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                  }}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="relative w-[52px] h-16 rounded-[8px] overflow-hidden bg-linen flex-shrink-0"
                      style={{ opacity: p.active ? 1 : 0.5 }}
                    >
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="52px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-medium text-[15px] text-obsidian truncate">
                        {p.name}
                      </div>
                      <div className="font-body text-[13px] text-graphite mt-0.5">
                        {p.category} · {p.price}
                      </div>
                    </div>
                  </div>

                  <div className="w-[120px] flex-shrink-0 text-right">
                    <span className={cn("font-body text-[13px]", stockTone)}>
                      {isSoldOut ? "Esgotado" : `${p.stock} em estoque`}
                    </span>
                  </div>

                  <div className="w-[140px] flex-shrink-0 flex items-center gap-2.5">
                    <Switch
                      checked={p.active ?? true}
                      onChange={() => toggleActive(p.id)}
                    />
                    <span
                      className={cn(
                        "font-body text-[13px]",
                        p.active ? "text-success" : "text-inactive"
                      )}
                    >
                      {p.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="flex gap-1 flex-shrink-0 w-[76px]">
                    <Link
                      href={`/painel/produtos/${p.id}`}
                      aria-label="Editar"
                      className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-obsidian flex items-center justify-center hover:bg-surface-hover transition-colors"
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      onClick={() => setConfirm(p)}
                      aria-label="Excluir"
                      className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-error flex items-center justify-center hover:bg-error-surface transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
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
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              iconLeft={<Trash2 size={18} />}
              onClick={() => removeProduct(confirm.id)}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}
