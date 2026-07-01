"use client";

import { useActionState, useState } from "react";
import { createProduct, updateProduct } from "@/app/actions/produtos";
import { createCategory } from "@/app/actions/categorias";
import { compressImage } from "@/lib/image-compress";
import { formatCents, maskCurrencyInput } from "@/lib/utils";
import type { StoreProduct, StoreCategory, ProductColor } from "@/lib/types";

type FormState = { error: string } | null;

export function useProdutoForm(
  categories: StoreCategory[],
  maxPhotos: number,
  product?: StoreProduct
) {
  const editing = !!product;
  const boundAction = editing ? updateProduct : createProduct;

  const [existingPhotos, setExistingPhotos] = useState<string[]>(
    product?.images ?? []
  );
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? ["PP", "P", "M", "G"]);
  const [soldSizes, setSoldSizes] = useState<string[]>(product?.soldSizes ?? []);
  const [colors, setColors] = useState<ProductColor[]>(product?.colors ?? []);
  const [category, setCategory] = useState(product?.categoryId ?? "");
  const [catList, setCatList] = useState<StoreCategory[]>(categories);
  const [visible, setVisible] = useState(product?.isActive ?? true);
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(
    null
  );
  const [deleteModal, setDeleteModal] = useState(false);
  const [quickCat, setQuickCat] = useState(false);
  const [catDraft, setCatDraft] = useState("");
  const [price, setPriceRaw] = useState(
    product ? formatCents(product.priceCents).replace("R$ ", "") : ""
  );
  const setPrice = (raw: string) => setPriceRaw(maskCurrencyInput(raw));

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      if (editing && product) formData.set("id", product.id);
      formData.set("existing_images", JSON.stringify(existingPhotos));
      newPhotos.forEach((f) => formData.append("photos", f));
      formData.set("sizes", JSON.stringify(sizes));
      formData.set("soldSizes", JSON.stringify(soldSizes));
      formData.set("colors", JSON.stringify(colors));
      const selected = catList.find((c) => c.id === category || c.name === category);
      formData.set("categoryId", selected && selected.id !== selected.name ? selected.id : "");
      formData.set("isActive", String(visible));
      formData.set("isNew", String(isNew));
      return boundAction(prev, formData);
    },
    null
  );

  const totalPhotos = existingPhotos.length + newPhotos.length;
  const photosFull = totalPhotos >= maxPhotos;

  const flash = (msg: string, tone: "success" | "error" = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const room = maxPhotos - totalPhotos;
    if (room <= 0) {
      flash(`Seu plano permite no máximo ${maxPhotos} fotos`, "error");
      return;
    }
    const selected = Array.from(files).slice(0, room);
    const compressed = await Promise.all(selected.map((f) => compressImage(f)));
    setNewPhotos((prev) => [...prev, ...compressed]);
  };

  const removeExisting = (url: string) =>
    setExistingPhotos((prev) => prev.filter((u) => u !== url));
  const removeNew = (idx: number) =>
    setNewPhotos((prev) => prev.filter((_, i) => i !== idx));

  const createCat = async () => {
    const v = catDraft.trim();
    if (!v) return;
    if (catList.some((c) => c.name === v)) {
      flash("Essa categoria já existe", "error");
      setQuickCat(false);
      setCatDraft("");
      return;
    }
    const fd = new FormData();
    fd.set("name", v);
    const res = await createCategory(null, fd);
    if (res && "error" in res) {
      flash(res.error, "error");
      return;
    }
    setCatList((prev) => [
      ...prev,
      { id: v, name: v, position: prev.length, productCount: 0 },
    ]);
    setCategory(v);
    setQuickCat(false);
    setCatDraft("");
    flash("Categoria criada");
  };

  return {
    editing,
    state,
    formAction,
    pending,
    existingPhotos,
    newPhotos,
    photosFull,
    addPhotos,
    removeExisting,
    removeNew,
    sizes,
    setSizes,
    soldSizes,
    setSoldSizes,
    colors,
    setColors,
    category,
    setCategory,
    catList,
    visible,
    setVisible,
    isNew,
    setIsNew,
    toast,
    deleteModal,
    setDeleteModal,
    quickCat,
    setQuickCat,
    catDraft,
    setCatDraft,
    price,
    setPrice,
    createCat,
  };
}
