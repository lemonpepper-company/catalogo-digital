"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

/**
 * Mesmo padrão de `app/painel/produtos/use-produtos-filtros.ts`: o termo digitado
 * vive no input e, depois do debounce, vai para a URL — quem filtra é o servidor.
 * A URL nova nunca leva `page`, então uma busca sempre recomeça na página 1 e a
 * paginação é recalculada sobre o resultado filtrado (ORD-35.10).
 */
export function usePedidosBusca(initialQuery: string) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const trimmed = value.trim();
      router.replace(
        trimmed ? `/painel/pedidos?q=${encodeURIComponent(trimmed)}` : "/painel/pedidos",
        { scroll: false }
      );
    }, DEBOUNCE_MS);
  };

  return { query, onQueryChange };
}
