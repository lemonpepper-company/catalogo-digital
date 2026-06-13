"use client";

import { useState, useRef } from "react";

function slugify(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function useCadastroForm() {
  const [showPw, setShowPw] = useState(false);
  const [slug, setSlug] = useState("sua-loja");
  const storeRef = useRef<HTMLInputElement>(null);

  const togglePw = () => setShowPw((v) => !v);

  const handleStoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = slugify(e.target.value);
    setSlug(s || "sua-loja");
  };

  return { showPw, togglePw, slug, storeRef, handleStoreChange };
}
