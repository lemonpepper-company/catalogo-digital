"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

/**
 * Mesmo padrão de `app/painel/produtos/use-produtos-filtros.ts`: o termo digitado
 * vive no input e, depois do debounce, vai para a URL — quem filtra é o servidor.
 * `extraParams` (o período ativo, quando houver) é preservado na URL junto do
 * termo de busca, para que trocar de busca não derrube um filtro de período já
 * aplicado (ORD-46). A URL nova nunca leva `page`, então uma busca sempre
 * recomeça na página 1 e a paginação é recalculada sobre o resultado filtrado
 * (ORD-35.10). `startTransition` vem de `PedidosClient` — um único useTransition
 * por página, compartilhado com o filtro de período (ORD-50).
 */
export function usePedidosBusca(
  initialQuery: string,
  startTransition: (callback: () => void) => void,
  extraParams: Record<string, string> = {}
) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const trimmed = value.trim();
      const params = new URLSearchParams(extraParams);
      if (trimmed) params.set("q", trimmed);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/painel/pedidos?${qs}` : "/painel/pedidos", { scroll: false });
      });
    }, DEBOUNCE_MS);
  };

  return { query, onQueryChange };
}
