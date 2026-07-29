# Filtro de período em Vendas pela vitrine (Dashboard) e em Pedidos; remoção de Produtos recentes

**Data:** 2026-07-29
**Status:** Aprovado para planejamento

## Objetivo

Três ajustes pequenos e relacionados, levantados numa mesma rodada:

1. A Dashboard (`/painel`) mostra uma lista de "Produtos recentes" que não tem relação com o propósito de um dashboard (resumo/métricas) — já existe uma tela própria para navegar produtos (`/painel/produtos`).
2. O card "Vendas pela vitrine" na Dashboard mostra métricas de pedidos ([lib/order-metrics.ts](../../../lib/order-metrics.ts)) fixas no **mês corrente**, sem possibilidade de ver outro período.
3. `/painel/pedidos` ([PedidosClient.tsx](../../../app/painel/pedidos/PedidosClient.tsx)) já tem busca por código/nome e paginação, mas nenhum filtro por data — um lojista não consegue isolar pedidos de um dia ou período específico.

Os itens 2 e 3 compartilham a mesma necessidade (escolher um período) e por isso ganham um único componente e uma única lógica de resolução de período, usados nos dois lugares.

## Escopo

**Dentro:**
- Remoção completa da seção "Produtos recentes" da Dashboard, sem substituto.
- Componente `PeriodoFiltro` compartilhado: presets "Hoje" / "7 dias" / "Este mês" / "Todo período" (default "Este mês") + opção "Personalizado" com range customizado (dois `<input type="date">` nativos).
- Estado do período refletido na URL (`periodo=hoje|7d|mes|tudo` ou `de=YYYY-MM-DD&ate=YYYY-MM-DD` para range customizado), no mesmo espírito de `?q=`/`?page=` já usados em Pedidos.
- Lógica pura de resolução de período (`lib/period-filter.ts`), reaproveitada por Dashboard e Pedidos, calculada no fuso `America/Sao_Paulo`.
- Dashboard: as 3 métricas de "Vendas pela vitrine" (pedidos, vendas confirmadas, aguardando confirmação) passam a refletir o período escolhido — inclusive "Aguardando confirmação", que hoje é sempre todo o histórico.
- Pedidos: o filtro de período combina com a busca por código/nome já existente (E lógico, não substitui), reseta a paginação para página 1 ao mudar, e é preservado nos links de paginação.
- Rótulos das métricas da Dashboard deixam de fixar "no mês" (viram "Pedidos", "Vendas confirmadas", "Aguardando confirmação"), já que o período correto aparece no seletor.

**Fora desta rodada:**
- Qualquer filtro adicional em Pedidos além de período (ex: por status) — não foi pedido.
- Persistência do período entre sessões (ex: localStorage) — vive só na URL da navegação atual, mesmo padrão dos filtros de produtos.
- Exportação/CSV de pedidos filtrados.
- Novo componente de calendário visual (date range picker gráfico) — os inputs nativos de data cobrem o caso sem depender de uma lib nova.

## Estratégia

### Remoção de "Produtos recentes"

Em [DashboardClient.tsx](../../../app/painel/DashboardClient.tsx), remove o bloco inteiro (título "Produtos recentes", link "Ver todos" e a lista de até 4 produtos, linhas 127–190). Em [use-dashboard.ts](../../../app/painel/use-dashboard.ts), remove o cálculo de `recent` (`products.slice(0, 4)`) — não é mais consumido por ninguém. `products` continua sendo prop de `DashboardClient` pois alimenta `activeProducts`/`soldOutProducts`/`total` dos StatCards do topo.

### `lib/period-filter.ts` (lógica pura, sem I/O)

```ts
export type PeriodPreset = "hoje" | "7d" | "mes" | "tudo";
export const PERIOD_PRESETS: PeriodPreset[] = ["hoje", "7d", "mes", "tudo"];

export interface PeriodRange {
  from: Date;
  to: Date;
}

export interface PeriodParams {
  periodo?: string;
  de?: string;
  ate?: string;
}

/**
 * `null` = "tudo" (sem filtro de data). Range customizado (`de`/`ate` válidos)
 * tem prioridade sobre `periodo`. Combinações inválidas (preset desconhecido,
 * datas malformadas, `ate` antes de `de`) caem no default "mes", mesmo espírito
 * do `clampPage` para paginação inválida — nunca lança, nunca aceita "tudo"
 * por engano.
 */
export function resolvePeriodRange(params: PeriodParams, now: Date = new Date()): PeriodRange | null;

/** Preset ou "custom" atualmente ativo, para destacar o botão certo na UI. */
export function activePeriodToken(params: PeriodParams): PeriodPreset | "custom";
```

Internamente reaproveita os helpers zonados que já existem em `lib/order-metrics.ts` (`zonedParts`, `zoneOffsetMs`). `monthStartInSaoPaulo` é generalizado para um `dayStartInSaoPaulo(date)` (meia-noite do dia, fuso São Paulo) do qual `resolvePeriodRange` deriva "hoje" (dia atual), "7d" (6 dias atrás até agora), "mes" (dia 1 do mês corrente até agora) e o range customizado (`de` 00:00 até `ate` 23:59:59.999, ambos no fuso São Paulo). `order-metrics.ts` passa a importar `dayStartInSaoPaulo` de `period-filter.ts` em vez de duplicá-lo.

### `PeriodoFiltro` (componente client, `components/painel/PeriodoFiltro.tsx`)

```ts
interface PeriodoFiltroProps {
  basePath: string;        // "/painel" ou "/painel/pedidos"
  periodo?: string;
  de?: string;
  ate?: string;
  extraParams?: Record<string, string>; // ex: { q } em Pedidos, preservado ao trocar período
}
```

- Pills/dropdown com os 4 presets + "Personalizado". Selecionar um preset chama `router.replace` imediatamente (sem debounce), preservando `extraParams` e removendo `page` (reset de paginação quando aplicável).
- "Personalizado" revela os dois `<input type="date">` (estilo `Input` existente) com um botão "Aplicar" — só nesse clique o `router.replace` dispara com `de`/`ate` e sem `periodo`.
- `activePeriodToken` decide qual pill fica com o estilo "ativo" (mesmo tratamento visual que o `ORDER_STATUSES` map em `PedidosClient.tsx` já usa para status).

### Dashboard (`app/painel/page.tsx`)

Passa a receber `searchParams` (mesmo padrão de `PedidosPage`):

```ts
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const params = await searchParams;
  const range = resolvePeriodRange(params);

  const metrics = getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory
    ? await getOrderMetrics(store.id, range)
    : null;
  // ...restante igual, passa params para <PeriodoFiltro basePath="/painel" .../> dentro de DashboardClient
}
```

`getOrderMetrics(storeId, range: PeriodRange | null)` em [lib/server/pedidos.ts](../../../lib/server/pedidos.ts) troca o `monthStart` fixo: quando `range` é `null`, as duas queries (`monthResult`/pendentes) não aplicam `.gte`/`.lte` por data; quando `range` existe, ambas aplicam `.gte("created_at", range.from.toISOString()).lte("created_at", range.to.toISOString())` — inclusive a contagem de pendentes, que hoje é sempre todo o histórico e passa a respeitar o filtro. `computeOrderMetrics` não muda de assinatura, só o que chega nela já vem filtrado.

`OrderMetrics` mantém os mesmos 3 campos (`ordersThisMonth`, `confirmedCentsThisMonth`, `pendingCount`) — os nomes ficam levemente imprecisos fora do preset "mes", mas renomear exigiria tocar o teste de `order-metrics.test.ts` e `computeOrderMetrics` sem nenhum ganho funcional; a leitura correta do período já é garantida pelo rótulo dinâmico na UI, não pelo nome do campo.

Em `DashboardClient.tsx`, o cabeçalho da seção "Vendas pela vitrine" ganha o `PeriodoFiltro` ao lado do título, e os rótulos dos `StatCard` trocam de "Pedidos no mês" / "Vendas confirmadas no mês" para "Pedidos" / "Vendas confirmadas" (label de "Aguardando confirmação" já era neutro).

### Pedidos (`app/painel/pedidos/page.tsx` e `lib/server/pedidos.ts`)

```ts
export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; periodo?: string; de?: string; ate?: string }>;
}) {
  // ...gate de plano igual
  const { page: pageParam, q, periodo, de, ate } = await searchParams;
  const query = q ?? "";
  const range = resolvePeriodRange({ periodo, de, ate });
  const { orders, total, page, totalPages } = await getStoreOrders(
    store.id,
    Number(pageParam ?? "1"),
    query,
    range
  );
  // ...passa periodo/de/ate para PedidosClient junto do resto
}
```

`getStoreOrders(storeId, page, query, range)` em `lib/server/pedidos.ts` aplica o range com `.gte`/`.lte` em `created_at` nas duas queries (contagem e listagem), do mesmo jeito que o filtro de busca já é aplicado condicionalmente (`if (term) ...`) — os dois filtros (busca + período) se combinam com E lógico.

Em `PedidosClient.tsx`, o `PeriodoFiltro` aparece ao lado da caixa de busca (`flex flex-col sm:flex-row gap-3` — mesma linha em desktop, empilhado em mobile). `usePedidosBusca` (renomeado/estendido, ou um hook irmão) passa a incluir `periodo`/`de`/`ate` como `extraParams` do `PeriodoFiltro`, e o próprio `PeriodoFiltro` inclui `q` (quando presente) como `extraParams` ao trocar período — nenhum dos dois filtros apaga o outro. `Pagination` (já aceita `extraParams`) recebe `periodo`/`de`/`ate` além de `q`.

O subtítulo dinâmico atual ("X pedidos encontrados" / "Nenhum pedido combina com...") não muda de lógica — `isSearching`/`total` já cobrem o caso combinado, e o período filtrado não precisa de um texto próprio (o seletor já mostra o período ativo).

## Testes

- **`period-filter.test.ts`** (novo): cada preset resolve o range correto no fuso São Paulo (casos de borda: meia-noite, troca de mês); range customizado válido; datas malformadas ou `ate < de` caem no default "mes"; `activePeriodToken` identifica preset vs. custom corretamente.
- **`PeriodoFiltro.test.tsx`** (novo): clique num preset dispara `router.replace` com os params corretos e sem `page`; abrir "Personalizado" + preencher + "Aplicar" dispara com `de`/`ate` e sem `periodo`; `extraParams` (ex: `q`) é preservado.
- **`DashboardPage.test.tsx`** / **`server-pedidos.test.ts`** (estender): `getOrderMetrics` chamado com o range resolvido a partir de `searchParams`; `range: null` não aplica filtro de data em nenhuma das 3 métricas.
- **`DashboardClient.test.tsx`** (estender/limpar): remove os testes da lista de "Produtos recentes"; adiciona verificação dos novos rótulos ("Pedidos" em vez de "Pedidos no mês" etc.).
- **`PedidosPage.test.tsx`** / **`server-pedidos.test.ts`** (estender): `getStoreOrders` chamado com o range resolvido; período + busca combinados geram o `.or()` e o `.gte`/`.lte` juntos.
- **`PedidosClient.test.tsx`** (estender): `Pagination` recebe `periodo`/`de`/`ate` em `extraParams` junto com `q`.
- Teste manual no navegador: trocar presets na Dashboard e ver as 3 métricas mudarem; usar range customizado; em Pedidos, combinar busca + período e ver a lista e a contagem corretas; navegar entre páginas com período ativo e confirmar que não se perde; conferir que "Produtos recentes" sumiu da Dashboard sem deixar espaço vazio estranho.
