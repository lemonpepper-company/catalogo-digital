"use client";

import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useCategorias } from "./use-categorias";

export function CategoriasClient() {
  const {
    categories,
    creating,
    setCreating,
    createDraft,
    setCreateDraft,
    editingCat,
    setEditingCat,
    editDraft,
    setEditDraft,
    deleteTarget,
    setDeleteTarget,
    toast,
    countFor,
    create,
    save,
    remove,
  } = useCategorias();

  return (
    <div className="max-w-form flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Categorias
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            Organize as peças do seu catálogo.
          </p>
        </div>
        {!creating && (
          <Button
            variant="primary"
            iconLeft={<Plus size={18} />}
            onClick={() => setCreating(true)}
          >
            Nova categoria
          </Button>
        )}
      </div>

      <Card pad={0} className="overflow-hidden">
        {creating && (
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-linen border-b border-sand/50">
            <input
              autoFocus
              value={createDraft}
              onChange={(e) => setCreateDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") {
                  setCreateDraft("");
                  setCreating(false);
                }
              }}
              placeholder="Nome da categoria"
              className="flex-1 h-11 px-4 rounded-input bg-white font-body text-[15px] text-obsidian outline-none"
              style={{ border: "1px solid var(--color-primary)" }}
            />
            <Button variant="primary" onClick={create}>
              Salvar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreateDraft("");
                setCreating(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        )}

        {categories.length === 0 && !creating ? (
          <div className="px-5 py-10 text-center font-body text-[15px] text-graphite">
            Nenhuma categoria ainda. Crie a primeira acima.
          </div>
        ) : (
          categories.map((cat, i) =>
            editingCat === cat ? (
              <div
                key={cat}
                className="flex items-center gap-2.5 px-5 py-3.5"
                style={{
                  borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                }}
              >
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(cat);
                    if (e.key === "Escape") setEditingCat(null);
                  }}
                  className="flex-1 h-10 px-3.5 rounded-input bg-white font-body text-[15px] text-obsidian outline-none"
                  style={{ border: "1px solid var(--color-primary)" }}
                />
                <Button variant="primary" size="sm" onClick={() => save(cat)}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingCat(null)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div
                key={cat}
                className="flex items-center gap-4 px-5 py-3.5"
                style={{
                  borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                }}
              >
                <div className="w-9 h-9 rounded-[8px] bg-linen flex items-center justify-center text-graphite flex-shrink-0">
                  <Layers size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-medium text-[15px] text-obsidian">
                    {cat}
                  </div>
                  <div className="font-body text-[13px] text-graphite mt-0.5">
                    {countFor(cat)} {countFor(cat) === 1 ? "produto" : "produtos"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditDraft(cat);
                      setEditingCat(cat);
                    }}
                    aria-label="Editar"
                    className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-obsidian flex items-center justify-center hover:bg-surface-hover transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    aria-label="Excluir"
                    className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-error flex items-center justify-center hover:bg-error-surface transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          )
        )}
      </Card>

      {deleteTarget && (
        <Modal title="Excluir categoria" onClose={() => setDeleteTarget(null)}>
          <p className="font-body text-[15px] text-graphite leading-relaxed">
            Tem certeza que deseja excluir{" "}
            <strong className="text-obsidian font-semibold">{deleteTarget}</strong>?
            Os produtos desta categoria não serão afetados.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              iconLeft={<Trash2 size={18} />}
              onClick={() => remove(deleteTarget)}
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
