# Scroll infinito no catálogo público

**Data:** 2026-07-03
**Status:** Aprovado para planejamento

## Objetivo

O catálogo público (`/[slug]`) busca todos os produtos ativos da loja de uma vez no servidor (já cacheado via `unstable_cache`, ver [catalog.ts](../../../lib/server/catalog.ts)) e filtra por categoria/busca 100% no cliente ([use-catalogo.ts:35](../../../app/[slug]/use-catalogo.ts#L35)). Isso continua correto e não muda nesta rodada. O problema é só de renderização: hoje `CatalogoClient.tsx` monta **todos** os cards filtrados no DOM de uma vez ([CatalogoClient.tsx:102-111](../../../app/[slug]/CatalogoClient.tsx#L102-L111)), o que fica pesado conforme o catálogo cresce.

O objetivo é introduzir carregamento incremental (não confundir com virtualização — ver decisão abaixo): mostrar só um lote de produtos por vez, carregando mais automaticamente conforme o cliente rola a tela.

Este é o segundo de três sub-projetos de listagem (o primeiro, paginação do painel, já foi implementado — ver [2026-07-03-paginacao-painel-produtos-design.md](2026-07-03-paginacao-painel-produtos-design.md); o terceiro, reordenação de categorias, tem spec própria depois desta).

## Decisão: incremental, não virtualizado

Duas abordagens foram consideradas:
- **Carregamento incremental (escolhida):** conforme o cliente rola, mais cards são **adicionados** ao DOM (nunca removidos). Simples, sem dependência nova.
- **Virtualização de lista (ex: `react-virtual`):** só ficam no DOM os cards visíveis na tela; os que saem de vista são desmontados e reciclados. Mantém o DOM enxuto não importa o tamanho do catálogo, mas exige dependência nova e mais complexidade pra lidar com a grade responsiva (2/3/4 colunas, alturas de imagem variáveis).

Escolhido o carregamento incremental: as lojas deste produto são vitrines de moda (dezenas a poucas centenas de peças), não marketplaces de milhares de itens — o ganho da virtualização não compensa a complexidade extra agora. Se um catálogo real crescer a ponto de o DOM incremental pesar, revisita-se essa decisão.

## Escopo

**Dentro:**
- Lote de 24 produtos por carregamento (inicial e cada "carregar mais").
- Carregamento automático ao rolar (via `IntersectionObserver` num elemento sentinela após a grade), sem necessidade de clique.
- Reset do lote visível para 24 sempre que a categoria ativa ou o termo de busca mudar.
- Sentinela/observer só ativos quando há mais produtos filtrados do que os já visíveis.

**Fora desta rodada:**
- Qualquer mudança na busca ao servidor ou no cache do catálogo (`lib/server/catalog.ts`) — continua buscando tudo de uma vez, isso está correto.
- Virtualização de lista (ver decisão acima).
- Paginação do painel — já implementada (sub-projeto anterior).
- Reordenação de categorias — sub-projeto seguinte.

## Estratégia

### `use-catalogo.ts`

Novo estado `visibleCount` (inicial `24`), e duas novas saídas derivadas:

```ts
const INITIAL_VISIBLE = 24;
const LOAD_MORE_STEP = 24;

const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

useEffect(() => {
  setVisibleCount(INITIAL_VISIBLE);
}, [activeCategory, searchQuery]);

const visibleProducts = filteredProducts.slice(0, visibleCount);
const hasMore = visibleCount < filteredProducts.length;

const loadMore = useCallback(() => {
  setVisibleCount((prev) => prev + LOAD_MORE_STEP);
}, []);
```

`filteredProducts` continua existindo internamente (não é mais retornado pro componente — quem renderiza a grade agora é `visibleProducts`). `hasMore` e `loadMore` são as novas saídas do hook.

### `CatalogoClient.tsx`

A grade passa a mapear `visibleProducts` em vez de `filteredProducts`. Logo depois do `</div>` que fecha a grade, um elemento sentinela invisível, observado via `IntersectionObserver` num `useEffect`:

```tsx
const sentinelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!hasMore) return;
  const el = sentinelRef.current;
  if (!el) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) loadMore();
    },
    { rootMargin: "600px" }
  );
  observer.observe(el);
  return () => observer.disconnect();
}, [hasMore, loadMore]);
```

```tsx
{visibleProducts.map((product, index) => (
  <ProductCard key={product.id} product={product} onOpen={setOpenProduct} priority={index < 2} />
))}
</div>

{hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
```

`rootMargin: "600px"` dispara o carregamento um pouco antes da sentinela realmente entrar na tela (evita um "flash" de fim de lista visível por uma fração de segundo antes de carregar mais).

## Testes

- Teste automatizado (Vitest + RTL) em `__tests__/CatalogoClient.test.tsx`: como `IntersectionObserver` não existe em `jsdom`, o teste define um dublê simples da classe (`global.IntersectionObserver`) que guarda o callback recebido, permitindo disparar manualmente `entries[0].isIntersecting = true` para simular "o cliente rolou até o fim". Cobre:
  - Carga inicial renderiza só os primeiros 24 produtos filtrados.
  - Disparar a interseção da sentinela renderiza mais 24 (até acabarem os produtos filtrados).
  - Trocar de categoria (clicar num `Pill`) rereseta a lista visível para 24, mesmo se antes já tinham sido carregados mais.
- Verificação manual num navegador real (não `jsdom` — usar as ferramentas de preview desta sessão, que rodam num Chromium de verdade, então `IntersectionObserver` funciona nativamente): abrir o catálogo público de uma loja com mais de 24 produtos ativos, rolar até o fim, confirmar que mais cards aparecem sozinhos sem clique, trocar de categoria e confirmar que a lista volta a mostrar só os primeiros 24 daquela categoria.
