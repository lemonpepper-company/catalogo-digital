"use client";

import { useState } from "react";
import type { Product, ToastState } from "@/lib/types";

const BASE_CATEGORIES = ["Vestidos", "Blusas", "Calças", "Saias"];

export function useProdutoForm(product?: Product) {
  const [photos, setPhotos] = useState<string[]>(
    product ? [product.image] : []
  );
  const [sizes, setSizes] = useState<string[]>(
    product?.sizes ?? ["PP", "P", "M", "G"]
  );
  const [colors, setColors] = useState<string[]>(
    product?.colors.map((c) => c.label) ?? ["Areia", "Caramelo"]
  );
  const [category, setCategory] = useState(product?.category ?? "");
  const [categories, setCategories] = useState<string[]>(BASE_CATEGORIES);
  const [soldout, setSoldout] = useState(product?.soldOut ?? false);
  const [visible, setVisible] = useState(product?.active ?? true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [quickCat, setQuickCat] = useState(false);
  const [catDraft, setCatDraft] = useState("");

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const createCategory = () => {
    const v = catDraft.trim();
    if (!v) return;
    if (categories.includes(v)) {
      flash("Essa categoria já existe", "error");
      setCategory(v);
      setQuickCat(false);
      setCatDraft("");
      return;
    }
    setCategories((prev) => [...prev, v]);
    setCategory(v);
    setQuickCat(false);
    setCatDraft("");
    flash("Categoria criada");
  };

  return {
    photos,
    setPhotos,
    sizes,
    setSizes,
    colors,
    setColors,
    category,
    setCategory,
    categories,
    soldout,
    setSoldout,
    visible,
    setVisible,
    toast,
    deleteModal,
    setDeleteModal,
    quickCat,
    setQuickCat,
    catDraft,
    setCatDraft,
    flash,
    createCategory,
  };
}
