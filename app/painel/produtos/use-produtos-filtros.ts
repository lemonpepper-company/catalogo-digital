"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

export function useProdutosFiltros(
  initialQ: string,
  initialCategoria: string,
  initialStatus: string
) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const qRef = useRef(initialQ);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replace = (nextQ: string, nextCategoria: string, nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextCategoria) params.set("categoria", nextCategoria);
    if (nextStatus) params.set("status", nextStatus);
    const qs = params.toString();
    router.replace(`/painel/produtos${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const onQChange = (value: string) => {
    setQ(value);
    qRef.current = value;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      replace(value, initialCategoria, initialStatus);
    }, DEBOUNCE_MS);
  };

  const onCategoriaChange = (value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    replace(qRef.current, value, initialStatus);
  };

  const onStatusChange = (value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    replace(qRef.current, initialCategoria, value);
  };

  const clearFilters = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setQ("");
    qRef.current = "";
    replace("", "", "");
  };

  return { q, onQChange, onCategoriaChange, onStatusChange, clearFilters };
}
