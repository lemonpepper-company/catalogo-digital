"use client";

import { useState, useTransition } from "react";
import {
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/app/actions/categorias";
import type { StoreCategory, ToastState } from "@/lib/types";

export function useCategorias(
  categories: StoreCategory[],
  maxCategories: number
) {
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoreCategory | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const limitReached = categories.length >= maxCategories;

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const create = () => {
    const v = createDraft.trim();
    if (!v) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", v);
      const res = await createCategory(null, fd);
      if (res && "error" in res) {
        flash(res.error, "error");
        return;
      }
      setCreateDraft("");
      setCreating(false);
      flash("Categoria criada");
    });
  };

  const save = (cat: StoreCategory) => {
    const v = editDraft.trim();
    if (!v) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", cat.id);
      fd.set("name", v);
      const res = await renameCategory(null, fd);
      if (res && "error" in res) {
        flash(res.error, "error");
        return;
      }
      setEditingCat(null);
      flash("Categoria atualizada");
    });
  };

  const remove = (cat: StoreCategory) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", cat.id);
      const res = await deleteCategory(null, fd);
      if (res && "error" in res) {
        flash(res.error, "error");
        setDeleteTarget(null);
        return;
      }
      setDeleteTarget(null);
      flash("Categoria excluída", "error");
    });
  };

  return {
    categories,
    limitReached,
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
    isPending,
    create,
    save,
    remove,
  };
}
