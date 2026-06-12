"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Upload,
  Star,
  Trash2,
  Plus,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ToggleRow } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { FASHION_COLORS } from "@/lib/data";
import type { Product, ToastState } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias"];

interface ProdutoFormClientProps {
  product?: Product;
}

function PhotoUploader({ photos, setPhotos }: {
  photos: string[];
  setPhotos: (p: string[]) => void;
}) {
  const remove = (i: number) => setPhotos(photos.filter((_, idx) => idx !== i));
  return (
    <div className="grid grid-cols-5 gap-3">
      {photos.map((src, i) => (
        <div
          key={i}
          className="relative aspect-square rounded-[12px] overflow-hidden border border-sand/50"
        >
          <Image src={src} alt="" fill sizes="20vw" className="object-cover" />
          {i === 0 && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 h-[22px] px-2 rounded-pill bg-obsidian/80 text-white font-body font-medium text-[10px] tracking-[0.06em] uppercase">
              <Star size={9} fill="currentColor" /> Capa
            </span>
          )}
          <button
            onClick={() => remove(i)}
            aria-label="Remover foto"
            className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full bg-white/90 text-obsidian flex items-center justify-center hover:bg-white transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {photos.length < 5 && (
        <button className="aspect-square rounded-[12px] border-[1.5px] border-dashed border-sand bg-linen flex flex-col items-center justify-center gap-1.5 text-graphite hover:bg-surface-hover transition-colors cursor-pointer">
          <Upload size={22} />
          <span className="font-body text-[12px]">Adicionar</span>
        </button>
      )}
    </div>
  );
}

function VariationEditor({
  title,
  items,
  setItems,
}: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
}) {
  const [on, setOn] = useState(true);
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) {
      setItems([...items, v]);
      setDraft("");
    }
  };

  return (
    <div>
      <ToggleRow
        label={title}
        desc={on ? "Edite as opções abaixo" : "Desativado"}
        checked={on}
        onChange={setOn}
      />
      {on && (
        <div className="flex flex-wrap gap-2 items-center py-2 pb-4">
          {items.map((it) => (
            <span
              key={it}
              className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-pill bg-linen border border-sand font-body text-[13px] text-obsidian"
            >
              {it}
              <button
                onClick={() => setItems(items.filter((x) => x !== it))}
                aria-label={`Remover ${it}`}
                className="w-5 h-5 rounded-full bg-transparent text-graphite hover:text-obsidian flex items-center justify-center transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="Novo…"
              className="w-20 h-8 px-3 rounded-pill border border-sand bg-white font-body text-[13px] text-obsidian outline-none focus:border-obsidian"
            />
            <button
              onClick={add}
              aria-label="Adicionar"
              className="w-8 h-8 rounded-full bg-obsidian text-white flex items-center justify-center hover:bg-[#1f1f1f] transition-colors"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorSelector({
  selected,
  setSelected,
}: {
  selected: string[];
  setSelected: (s: string[]) => void;
}) {
  const [on, setOn] = useState(true);

  const toggle = (name: string) =>
    setSelected(
      selected.includes(name)
        ? selected.filter((x) => x !== name)
        : [...selected, name]
    );

  const lightColors = new Set([
    "Branco",
    "Amarelo",
    "Prata",
    "Azul claro",
  ]);

  return (
    <div>
      <ToggleRow
        label="Cores"
        desc={on ? "Selecione na paleta abaixo" : "Desativado"}
        checked={on}
        onChange={setOn}
        accent
      />
      {on && (
        <div className="py-2 pb-4 flex flex-col gap-4">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((name) => {
                const c = FASHION_COLORS.find((fc) => fc.name === name);
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-2 h-8 pl-2 pr-1.5 rounded-pill bg-linen border border-sand font-body text-[13px] text-obsidian"
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-sand flex-shrink-0"
                      style={{ background: c?.hex ?? "#ccc" }}
                    />
                    {name}
                    <button
                      onClick={() => toggle(name)}
                      aria-label={`Remover ${name}`}
                      className="w-5 h-5 rounded-full bg-transparent text-graphite hover:text-obsidian flex items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {FASHION_COLORS.map((c) => {
              const isSelected = selected.includes(c.name);
              return (
                <button
                  key={c.name}
                  onClick={() => toggle(c.name)}
                  aria-label={c.name}
                  title={c.name}
                  className="w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center"
                  style={{
                    background: c.hex,
                    border: isSelected
                      ? "2px solid var(--color-primary)"
                      : "1px solid var(--color-border)",
                    outline: isSelected ? `2px solid ${c.hex}` : "none",
                    outlineOffset: isSelected ? "-4px" : "0",
                    boxSizing: "border-box",
                  }}
                >
                  {isSelected && (
                    <Check
                      size={14}
                      className={
                        lightColors.has(c.name) ? "text-obsidian" : "text-white"
                      }
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProdutoFormClient({ product }: ProdutoFormClientProps) {
  const editing = !!product;

  const [photos, setPhotos] = useState<string[]>(
    product ? [product.image] : []
  );
  const [sizes, setSizes] = useState<string[]>(
    product?.sizes ?? ["PP", "P", "M", "G"]
  );
  const [colors, setColors] = useState<string[]>(
    product?.colors.map((c) => c.label) ?? ["Areia", "Caramelo"]
  );
  const [soldout, setSoldout] = useState(product?.soldOut ?? false);
  const [visible, setVisible] = useState(product?.active ?? true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="max-w-form flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/painel/produtos"
          className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
        >
          ← Produtos
        </Link>
      </div>

      <h1 className="font-display font-semibold text-[28px] text-obsidian">
        {editing ? "Editar produto" : "Novo produto"}
      </h1>

      {/* Photos */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Fotos{" "}
          <span className="text-graphite font-normal">
            · mínimo 1, máximo 5
          </span>
        </h2>
        <PhotoUploader photos={photos} setPhotos={setPhotos} />
      </Card>

      {/* Info */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Informações
        </h2>
        <div className="grid grid-cols-2 gap-[18px]">
          <div className="col-span-2">
            <Input
              label="Nome do produto"
              defaultValue={editing ? product?.name : ""}
              placeholder="Ex: Vestido midi linho"
            />
          </div>
          <div className="col-span-2">
            <Textarea
              label="Descrição"
              rows={3}
              defaultValue={editing ? product?.desc : ""}
              placeholder="Conte sobre o caimento, tecido e cuidados…"
            />
          </div>
          <Input
            label="Preço"
            prefix="R$"
            defaultValue={editing ? product?.price.replace("R$ ", "") : ""}
            placeholder="0,00"
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-medium text-[13px] text-obsidian">
              Categoria
            </label>
            <select
              defaultValue={product?.category ?? ""}
              className="h-11 w-full rounded-input border border-sand bg-white px-3 font-body text-[14px] text-obsidian focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2 transition-all"
            >
              <option value="">Selecione uma categoria</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Variations */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Variações
        </h2>
        <VariationEditor title="Tamanhos" items={sizes} setItems={setSizes} />
        <ColorSelector selected={colors} setSelected={setColors} />
      </Card>

      {/* Stock */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Estoque & visibilidade
        </h2>
        <div className="grid grid-cols-2 gap-[18px] pb-2">
          <Input
            label="Quantidade em estoque"
            type="number"
            defaultValue={product?.stock?.toString() ?? "12"}
          />
        </div>
        <ToggleRow
          label="Marcar como esgotado"
          desc="Mostra o badge Esgotado e desabilita o botão de compra"
          checked={soldout}
          onChange={setSoldout}
          accent
        />
        <ToggleRow
          label="Visível no catálogo"
          desc="Produtos inativos não aparecem para o cliente"
          checked={visible}
          onChange={setVisible}
        />
      </Card>

      {/* Actions footer */}
      <div className="flex justify-between gap-3 pb-6">
        {editing ? (
          <Button
            variant="destructive"
            iconLeft={<Trash2 size={18} />}
            onClick={() => setDeleteModal(true)}
          >
            Excluir produto
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => history.back()}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              flash("Produto salvo");
            }}
          >
            Salvar produto
          </Button>
        </div>
      </div>

      {deleteModal && (
        <Modal title="Excluir produto" onClose={() => setDeleteModal(false)}>
          <p className="font-body text-[15px] text-graphite leading-relaxed">
            Tem certeza que deseja excluir este produto? Essa ação não pode ser
            desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              iconLeft={<Trash2 size={18} />}
              onClick={() => {
                flash("Produto excluído", "error");
                setDeleteModal(false);
              }}
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
