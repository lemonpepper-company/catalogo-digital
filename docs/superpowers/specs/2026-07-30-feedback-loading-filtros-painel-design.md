# Feedback de loading unificado nos filtros do painel

**Data:** 2026-07-30
**Status:** Aprovado para planejamento

## Objetivo

O feedback de loading adicionado em [2026-07-29-filtro-de-periodo-dashboard-e-pedidos-design.md](2026-07-29-filtro-de-periodo-dashboard-e-pedidos-design.md) só cobre o dropdown de período em si (spinner + desabilitado). Trocar a busca em Pedidos, ou qualquer filtro em Produtos (nome/categoria/status), não dá nenhum feedback visual — a tela fica parada até o novo conteúdo chegar, dando a impressão de estar travada.

O objetivo é: qualquer mudança de filtro em qualquer uma das três telas do painel mostra feedback de loading, coerente entre si.

## Escopo

**Dentro:**
- **Dashboard**: os 3 `StatCard` de "Vendas pela vitrine" mostram um spinner no lugar do número enquanto o período está sendo trocado.
- **Pedidos**: a lista de pedidos inteira vira skeleton (reaproveitando o mesmo skeleton do carregamento inicial da rota) quando busca **ou** período mudam — qualquer um dos dois aciona o mesmo indicador.
- **Produtos**: a listagem inteira vira skeleton (mesmo princípio) quando nome, categoria **ou** status mudam.
- Cada tela passa a ter **um único** sinal de "carregando" (`useTransition` no componente client de página), compartilhado entre todos os filtros daquela tela — hoje `PeriodoFiltro` e a busca de Pedidos têm cada um o seu próprio `useTransition` isolado, então mudar um não avisa o outro.
- **Bug de sobra**: `app/painel/loading.tsx` (skeleton de carregamento inicial de `/painel`) ainda simula a lista "Produtos recentes", removida do `DashboardClient` no início desta sessão — nunca é substituída pelo conteúdo real porque a seção não existe mais. Remove esse bloco morto.
- Extrai `OrderRowSkeleton` (de `app/painel/pedidos/loading.tsx`) e `ProductRowSkeleton` (de `app/painel/produtos/loading.tsx`) para componentes compartilhados em `components/painel/`, reaproveitados tanto pelo `loading.tsx` de cada rota (carregamento inicial) quanto pelo componente client da própria tela (troca de filtro).

**Fora desta rodada:**
- Unificar o helper `Sk` (bloco cinza pulsante) num único lugar — hoje duplicado em 6 arquivos `loading.tsx` diferentes; não é o problema que estamos resolvendo agora.
- Loading feedback em paginação (`components/ui/Pagination.tsx` usa `<Link>`, mecanismo diferente de `router.replace`) — não foi pedido.
- Loading feedback nos filtros de Categorias ou em qualquer outra tela do painel além de Dashboard/Pedidos/Produtos.

## Estratégia

### Padrão comum: `useTransition` no componente de página, injetado nos hooks/filho

Cada componente client de página (`DashboardClient`, `PedidosClient`, `ProdutosClient`) passa a chamar `const [isPending, startTransition] = useTransition();` uma única vez. Esse `startTransition` é passado para dentro de quem hoje chama `router.replace`:

- `PeriodoFiltro` ganha duas props novas e **obrigatórias**: `isPending: boolean` e `startTransition: (callback: () => void) => void`. Remove o `useTransition` interno que tem hoje — quem manda é o pai.
- `usePedidosBusca(initialQuery, startTransition, extraParams?)` ganha `startTransition` como novo parâmetro obrigatório (2º, antes de `extraParams` que continua opcional com default `{}`). Não retorna mais `isPending` próprio — quem usa o hook já tem o `isPending` do pai.
- `useProdutosFiltros(initialQ, initialCategoria, initialStatus, startTransition)` ganha `startTransition` como 4º parâmetro obrigatório, usado para envolver a chamada de `router.replace` dentro de `replace(...)`.

Como nenhum desses três é usado fora do respectivo componente de página, tornar o parâmetro obrigatório (em vez de opcional com fallback) evita estado interno morto e deixa o TypeScript pegar qualquer lugar esquecido.

### Dashboard

`DashboardClient.tsx`:
```tsx
const [isPending, startTransition] = useTransition();
...
<PeriodoFiltro basePath="/painel" periodo={periodo} de={de} ate={ate} isPending={isPending} startTransition={startTransition} />
...
{orderStats.map((stat) => (
  <StatCard key={stat.label} value={stat.value} label={stat.label} loading={isPending} />
))}
```
Os 3 `StatCard` de "Produtos ativos/esgotados/no catálogo" (não filtrados por período) continuam sem a prop `loading` — comportamento inalterado.

`components/ui/StatCard.tsx` ganha uma prop opcional `loading?: boolean` (default `false`, então todo uso existente continua idêntico). Quando `true`, mostra um `Loader2` (`lucide-react`, `animate-spin`) no lugar do número, mantendo o rótulo visível embaixo e a altura do card estável (evita pulo de layout).

### Pedidos

`PedidosClient.tsx` cria seu próprio `useTransition` (nomeado `filtersPending`/`startTransition` para não colidir com o `statusPending` que `usePedidos()` já expõe para a troca de status do pedido — sinal diferente, não relacionado a filtro). Passa `startTransition` para `usePedidosBusca` e para `PeriodoFiltro`; usa `filtersPending` tanto no ícone de busca (já trocava lupa por spinner — passa a refletir esse sinal único em vez do `isPending` que o próprio hook devolvia) quanto na lista.

A lista passa a checar `filtersPending` **antes** do `orders.length === 0`:
```tsx
{filtersPending ? (
  <Card pad={0} className="overflow-hidden">
    {Array.from({ length: orders.length || 6 }).map((_, i) => (
      <OrderRowSkeleton key={i} first={i === 0} />
    ))}
  </Card>
) : orders.length === 0 ? (
  /* estado vazio, como hoje */
) : (
  /* lista real + paginação, como hoje */
)}
```
`orders` durante a transição ainda é a lista **anterior** (o React só troca as props depois que a transição resolve), então `orders.length || 6` mantém a altura do skeleton parecida com a lista que estava visível — cai em 6 linhas (mesmo número do `loading.tsx`) só quando a tela anterior já estava vazia.

### Produtos

Mesmo padrão: `ProdutosClient.tsx` cria `const [filtersPending, startTransition] = useTransition();` (nome escolhido para não colidir com o `isPending` que `useProdutos()` já expõe — esse é para ativar/destacar/excluir produto, sinal diferente). Passa `startTransition` para `useProdutosFiltros`. A listagem segue o mesmo formato condicional acima, usando `ProductRowSkeleton` e `products.length || 6`. Os dois `Select` de categoria/status (e a busca, só visualmente — sem desabilitar o campo, mesma decisão já tomada para a busca de Pedidos) ficam com `opacity-60 pointer-events-none` enquanto `filtersPending`, mesmo tratamento que o dropdown de período já tem.

### Skeletons compartilhados

Novos arquivos, cada um com seu próprio helper `Sk` local (mesma duplicação que já existe entre os 6 `loading.tsx` do painel — não é o problema desta rodada):

- `components/painel/OrderRowSkeleton.tsx` — exporta `OrderRowSkeleton({ first }: { first?: boolean })`, conteúdo idêntico ao que hoje está inline em `app/painel/pedidos/loading.tsx`.
- `components/painel/ProductRowSkeleton.tsx` — exporta `ProductRowSkeleton({ first }: { first?: boolean })`, conteúdo idêntico ao que hoje está inline em `app/painel/produtos/loading.tsx` (as duas variantes, mobile e desktop).

`app/painel/pedidos/loading.tsx` e `app/painel/produtos/loading.tsx` passam a importar desses novos arquivos em vez de definir a função localmente — o carregamento inicial da rota continua visualmente idêntico.

### Correção do skeleton órfão

`app/painel/loading.tsx`: remove a função local `ProductRowSkeleton` (linhas 14-25 hoje) e o bloco que a usa (o card com heading + 4 `ProductRowSkeleton`, simulando "Produtos recentes"). O helper `Sk` continua no arquivo — ainda usado por `StatCardSkeleton` e pelos outros blocos de skeleton da página.

## Testes

- **`StatCard.test.tsx`** (não existe hoje, criado nesta rodada): com `loading`, mostra o spinner e não mostra o `value`; sem `loading` (ou omitido), comportamento idêntico ao atual.
- **`PeriodoFiltro.test.tsx`**: ajusta os testes de loading já existentes (ORD-49) para passar `isPending`/`startTransition` via props em vez de mockar `useTransition` do módulo `react` — o controle do pending state passa a ser direto (prop), não precisa mais do mock.
- **`DashboardClient.test.tsx`**: com o período pendente (mock de `startTransition` que não chama o callback imediatamente, ou controle via prop equivalente), os 3 `StatCard` de vendas mostram loading; os de produto não.
- **`PedidosClient.test.tsx`**: trocar busca OU período aciona o mesmo `filtersPending` — lista vira skeleton nos dois casos; ícone de busca também reflete o mesmo sinal.
- **`ProdutosClient.test.tsx`** (existe hoje, estender): trocar nome, categoria ou status aciona skeleton na listagem.
- **`app/painel/loading.tsx`**: não há teste dedicado (confirmado — não existe nenhum arquivo `*loading*.test.tsx` no repositório hoje); a remoção do bloco morto não precisa de teste novo.
- Teste manual no navegador: trocar período na Dashboard e ver os 3 cards piscarem loading; em Pedidos, digitar na busca e trocar período, confirmando que os dois acendem o mesmo skeleton na lista; em Produtos, trocar categoria/status/nome e ver a listagem virar skeleton; recarregar `/painel` do zero e confirmar que o skeleton inicial não mostra mais nenhum vestígio de "Produtos recentes".
