"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { Upload, Star, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ToggleRow } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { FASHION_COLORS } from "@/lib/data";
import { deleteProduct } from "@/app/actions/produtos";
import type { StoreProduct, StoreCategory } from "@/lib/types";
import { useProdutoForm } from "./use-produto-form";

interface ProdutoFormClientProps {
  product?: StoreProduct;
  categories: StoreCategory[];
  maxPhotos?: number;
}

export function ProdutoFormClient({
  product,
  categories,
  maxPhotos = 5,
}: ProdutoFormClientProps) {
  const f = useProdutoForm(categories, maxPhotos, product);

  return (
    <form action={f.formAction} className="w-full lg:max-w-form flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/painel/produtos"
          className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
        >
          ← Produtos
        </Link>
      </div>

      <h1 className="font-display font-semibold text-[28px] text-obsidian">
        {f.editing ? "Editar produto" : "Novo produto"}
      </h1>

      {/* Fotos */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Fotos{" "}
          <span className="text-graphite font-normal">
            · mínimo 1, máximo {maxPhotos}
          </span>
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {f.existingPhotos.map((src, i) => (
            <div
              key={src}
              className="relative aspect-square rounded-[12px] overflow-hidden border border-sand/50"
            >
              <Image src={src} alt="" fill sizes="20vw" className="object-cover" />
              {i === 0 && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 h-[22px] px-2 rounded-pill bg-obsidian/80 text-white font-body font-medium text-[10px] tracking-[0.06em] uppercase">
                  <Star size={9} fill="currentColor" /> Capa
                </span>
              )}
              <button
                type="button"
                onClick={() => f.removeExisting(src)}
                aria-label="Remover foto"
                className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full bg-white/90 text-obsidian flex items-center justify-center hover:bg-white transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {f.newPhotos.map((file, i) => (
            <div
              key={`new-${i}`}
              className="relative aspect-square rounded-[12px] overflow-hidden border border-sand/50"
            >
              <Image
                src={URL.createObjectURL(file)}
                alt=""
                fill
                sizes="20vw"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => f.removeNew(i)}
                aria-label="Remover foto"
                className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full bg-white/90 text-obsidian flex items-center justify-center hover:bg-white transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!f.photosFull && (
            <label className="aspect-square rounded-[12px] border-[1.5px] border-dashed border-sand bg-linen flex flex-col items-center justify-center gap-1.5 text-graphite hover:bg-surface-hover transition-colors cursor-pointer">
              <Upload size={22} />
              <span className="font-body text-[12px]">Adicionar</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => f.addPhotos(e.target.files)}
              />
            </label>
          )}
        </div>
      </Card>

      {/* Informações */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Informações
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <div className="sm:col-span-2">
            <Input
              name="name"
              label="Nome do produto"
              value={f.name}
              onChange={(e) => f.setName(e.target.value)}
              placeholder="Ex: Vestido midi linho"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              name="description"
              label="Descrição"
              rows={3}
              value={f.description}
              onChange={(e) => f.setDescription(e.target.value)}
              placeholder="Conte sobre o caimento, tecido e cuidados…"
            />
          </div>
          <Input
            name="price"
            label="Preço"
            prefix="R$"
            value={f.price}
            onChange={f.handlePriceChange}
            inputMode="numeric"
            placeholder="0,00"
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-medium text-[13px] text-obsidian">
              Categoria
            </label>
            <Select
              value={
                f.catList.find((c) => c.id === f.category)?.name ?? f.category
              }
              placeholder="Selecione uma categoria"
              options={f.catList.map((c) => c.name)}
              onChange={(name) => {
                const found = f.catList.find((c) => c.name === name);
                f.setCategory(found ? found.id : name);
              }}
              footer={{
                label: "Nova categoria",
                onClick: () => {
                  f.setCatDraft("");
                  f.setQuickCat(true);
                },
              }}
            />
          </div>
        </div>
      </Card>

      {/* Variações */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Variações
        </h2>
        <ChipEditor title="Tamanhos" items={f.sizes} setItems={f.setSizes} />
        <ColorEditor selected={f.colors} setSelected={f.setColors} />
      </Card>

      {/* Estoque */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Estoque & visibilidade
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] pb-2">
          <Input
            name="stock"
            label="Quantidade em estoque"
            type="number"
            value={f.stock}
            onChange={(e) => f.setStock(e.target.value)}
          />
        </div>
        <ToggleRow
          label="Marcar como novidade"
          desc="Mostra o selo Novo no catálogo"
          checked={f.isNew}
          onChange={f.setIsNew}
          accent
        />
        <ToggleRow
          label="Visível no catálogo"
          desc="Produtos inativos não aparecem para o cliente"
          checked={f.visible}
          onChange={f.setVisible}
        />
      </Card>

      <div className="flex justify-between gap-3 pb-6">
        {f.editing ? (
          <Button
            type="button"
            variant="destructive"
            iconLeft={<Trash2 size={18} />}
            onClick={() => f.setDeleteModal(true)}
          >
            Excluir produto
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => history.back()}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={f.pending}>
            {f.pending ? "Salvando…" : "Salvar produto"}
          </Button>
        </div>
      </div>

      {f.state?.error && (
        <Toast msg={f.state.error} tone="error" />
      )}

      {f.editing && f.deleteModal && (
        <DeleteProductModal
          productId={product!.id}
          onClose={() => f.setDeleteModal(false)}
        />
      )}

      {f.quickCat && (
        <Modal title="Nova categoria" onClose={() => f.setQuickCat(false)}>
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-medium text-[13px] text-obsidian">
              Nome da categoria
            </label>
            <input
              autoFocus
              value={f.catDraft}
              onChange={(e) => f.setCatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  f.createCat();
                }
                if (e.key === "Escape") f.setQuickCat(false);
              }}
              placeholder="Ex: Acessórios"
              className="h-11 w-full rounded-input border border-sand bg-white px-4 font-body text-[15px] text-obsidian outline-none focus:border-obsidian transition-colors"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={f.creatingCat}
              onClick={() => f.setQuickCat(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={f.creatingCat}
              onClick={() => f.createCat()}
            >
              {f.creatingCat ? "Criando…" : "Criar categoria"}
            </Button>
          </div>
        </Modal>
      )}

      {f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}
    </form>
  );
}

/* ─── Chip editor (tamanhos) ─── */
function ChipEditor({
  title,
  items,
  setItems,
  soldItems,
  onToggleSold,
}: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
  soldItems?: string[];
  onToggleSold?: (item: string) => void;
}) {
  return (
    <div className="py-1 pb-4">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {items.map((it) => {
          const isSold = soldItems?.includes(it) ?? false;
          return (
            <span
              key={it}
              className={[
                "inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-pill border font-body text-[13px]",
                isSold
                  ? "bg-linen border-sand text-inactive line-through"
                  : "bg-linen border-sand text-obsidian",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onToggleSold?.(it)}
                disabled={!onToggleSold}
                aria-label={
                  isSold ? `Marcar ${it} como disponível` : `Marcar ${it} como esgotado`
                }
                className="disabled:cursor-default"
              >
                {it}
              </button>
              <button
                type="button"
                onClick={() => setItems(items.filter((x) => x !== it))}
                aria-label={`Remover ${it}`}
                className="w-5 h-5 rounded-full text-graphite hover:text-obsidian flex items-center justify-center transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <ChipInput onAdd={(v) => !items.includes(v) && setItems([...items, v])} />
      </div>
    </div>
  );
}

function ChipInput({ onAdd }: { onAdd: (v: string) => void }) {
  const [value, setValue] = useState("");

  const add = () => {
    const v = value.trim();
    if (v) {
      onAdd(v);
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Novo…"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        className="w-24 h-8 px-3 rounded-pill border border-sand bg-white font-body text-[13px] text-obsidian outline-none focus:border-obsidian transition-colors"
      />
      <button
        type="button"
        onClick={add}
        className="w-8 h-8 rounded-full bg-obsidian text-white flex items-center justify-center hover:bg-obsidian/80 transition-colors flex-shrink-0"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

/* ─── Color editor ─── */
function ColorEditor({
  selected,
  setSelected,
}: {
  selected: { label: string; hex: string }[];
  setSelected: (s: { label: string; hex: string }[]) => void;
}) {
  const [pickerHex, setPickerHex] = useState("#000000");
  const [pickerActive, setPickerActive] = useState(false);

  const fashionLabels = new Set(FASHION_COLORS.map((c) => c.name));
  const customColors = selected.filter((c) => !fashionLabels.has(c.label));

  const toggle = (label: string, hex: string) => {
    const exists = selected.some((c) => c.label === label);
    setSelected(
      exists ? selected.filter((c) => c.label !== label) : [...selected, { label, hex }]
    );
  };

  const addCustom = () => {
    if (!selected.some((c) => c.hex === pickerHex)) {
      setSelected([...selected, { label: `custom-${pickerHex.slice(1)}`, hex: pickerHex }]);
    }
    setPickerActive(false);
  };

  return (
    <div className="py-1.5 pb-4">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">Cores</div>
      <div className="flex flex-wrap gap-3 items-center">
        {FASHION_COLORS.map((c) => {
          const isSel = selected.some((s) => s.label === c.name);
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => toggle(c.name, c.hex)}
              aria-label={c.name}
              title={c.name}
              className="w-9 h-9 rounded-full transition-all duration-200"
              style={{
                background: c.hex,
                border: isSel
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
                outline: isSel ? "2px solid #fff" : "none",
                outlineOffset: isSel ? "-4px" : "0",
                boxSizing: "border-box",
              }}
            />
          );
        })}

        {customColors.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => toggle(c.label, c.hex)}
            title={c.hex}
            className="w-9 h-9 rounded-full transition-all duration-200"
            style={{
              background: c.hex,
              border: "2px solid var(--color-primary)",
              outline: "2px solid #fff",
              outlineOffset: "-4px",
              boxSizing: "border-box",
            }}
          />
        ))}

        <div className="flex items-center gap-2">
          <label
            className="relative w-9 h-9 rounded-full border border-dashed border-sand bg-linen flex items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors overflow-hidden"
            style={pickerActive ? { background: pickerHex, border: "none" } : {}}
            title="Adicionar cor personalizada"
          >
            {!pickerActive && (
              <Plus size={16} className="text-graphite pointer-events-none" />
            )}
            <input
              type="color"
              value={pickerHex}
              onChange={(e) => {
                setPickerHex(e.target.value);
                setPickerActive(true);
              }}
              className="sr-only"
            />
          </label>
          {pickerActive && (
            <button
              type="button"
              onClick={addCustom}
              className="font-body font-medium text-[13px] text-obsidian hover:underline"
            >
              + Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de exclusão ─── */
function DeleteProductModal({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleDelete = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", productId);
      const res = await deleteProduct(null, fd);
      if (res && "error" in res) return;
      router.push("/painel/produtos");
    });

  return (
    <Modal title="Excluir produto" onClose={onClose}>
      <p className="font-body text-[15px] text-graphite leading-relaxed">
        Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita.
      </p>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          iconLeft={<Trash2 size={18} />}
          disabled={pending}
          onClick={handleDelete}
        >
          {pending ? "Excluindo…" : "Excluir"}
        </Button>
      </div>
    </Modal>
  );
}
