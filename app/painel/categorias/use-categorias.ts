"use client";

import { useState } from "react";
import { PRODUCTS } from "@/lib/data";
import type { ToastState } from "@/lib/types";

const INITIAL_CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias"];

export function useCategorias() {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const countFor = (name: string) =>
    PRODUCTS.filter((p) => p.category === name).length;

  const create = () => {
    const v = createDraft.trim();
    if (!v) return;
    if (categories.includes(v)) {
      flash("Essa categoria já existe", "error");
      return;
    }
    setCategories([...categories, v]);
    setCreateDraft("");
    setCreating(false);
    flash("Categoria criada");
  };

  const save = (oldName: string) => {
    const v = editDraft.trim();
    if (!v) return;
    setCategories((prev) => prev.map((c) => (c === oldName ? v : c)));
    setEditingCat(null);
    flash("Categoria atualizada");
  };

  const remove = (name: string) => {
    setCategories((prev) => prev.filter((c) => c !== name));
    setDeleteTarget(null);
    flash("Categoria excluída", "error");
  };

  return {
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
  };
}
