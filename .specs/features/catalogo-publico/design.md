# Catálogo Público — Design

## Visão geral da arquitetura

```
app/[slug]/page.tsx            ← Server Component: resolve loja por slug, checa visibilidade,
  │                               busca produtos+categorias visíveis, mapeia p/ view-models
  ├─ notFound()                   se slug inexistente  → 404
  ├─ <CatalogExpired/>            se inativa/trial expirado
  └─ <CatalogoClient store products categories/>   (client, dono do estado da sacola)
        ├─ StoreHeader
        ├─ Pills (categorias)
        ├─ ProductCard[]
        ├─ ProductDetail (overlay)
        └─ BagDrawer  → checkout → renderWhatsAppTemplate() → window.open(wa.me)
```

Princípio: **Server Component busca dados; client só gerencia estado da sacola.** Os componentes de UI existentes (`StoreHeader`, `ProductCard`, `ProductDetail`, `BagDrawer`) não mudam de contrato — recebem os mesmos view-models `Store`/`Product`/`CartItem`.

## Camada de dados (server-only)

Novo módulo `lib/server/catalog.ts` (`import "server-only"`):

- `getPublicCatalog(slug)` → `{ store, products, categories } | { store, hidden: true } | null`
  - Busca a loja por slug (leitura pública já existe — `stores: slug lookup public`).
  - `null` → slug inexistente (page chama `notFound()`).
  - Checa visibilidade: `store.is_active === true` → se falso, retorna `{ store, hidden: true }`. (Cheque de trial volta com pagamento — passo 6.)
  - Se visível: busca `products` (`is_active=true and stock>0`, ordenados por `created_at desc`) e `categories` da loja; mapeia.
- `mapPublicStore(row) → Store` — `monogram` (fallback: iniciais do nome), `logoUrl`, `accentColor`, `whatsapp`, `catalogUrl`, `description`, `categories` (nomes derivados).
- `mapPublicProduct(row, categoryName) → Product` — `price` = `formatCents(price_cents)`, `image` = `images[0] ?? PLACEHOLDER`, `category` = `categoryName ?? "Todos"`, `desc`, `sizes`, `soldSizes`, `colors`, `isNew`, `stock`.

Reusa os tipos `StoreRow`/`ProductRow` já definidos em `lib/server/store.ts` (exportá-los ou duplicar mínimo). Reusa `formatCents`, `isTrialActive`.

### Categorias / pills

- Buscar `categories` da loja (`id, name, position`) ordenadas por `position`.
- Montar array de nomes visíveis: `"Todos"` + nomes de categorias que tenham ≥1 produto visível (interseção com os `category_id` presentes nos produtos retornados).
- `Store.categories` recebe esse array (contrato atual de `CatalogoClient`).

## RLS — nova migration

`supabase/migrations/<ts>_catalog_public_read.sql`:

```sql
-- Leitura pública do catálogo (papel anon E authenticated visitando outra loja)
create policy "products: public active read" on public.products
  for select using (is_active = true and stock > 0);

create policy "categories: public read" on public.categories
  for select using (true);

grant select on public.products   to anon;
grant select on public.categories to anon;
```

Notas:
- Sem cláusula `to <role>` → política permissiva aplicada a todos os papéis; políticas SELECT são OR-ed, então o dono (`authenticated`) continua vendo tudo pela policy "own store only".
- `stores` **não** precisa de policy nova (`init_auth.sql:27` já expõe leitura pública + grant anon).
- A regra `is_active and stock>0` no RLS reforça CAT-05 no próprio banco, mesmo que a query app esqueça o filtro.

## WhatsApp — template da loja

Nova função pura em `lib/utils.ts` (testável, sem I/O):

```ts
// Renderiza a mensagem final substituindo variáveis do template da loja.
// template null/vazio → usa DEFAULT_WHATSAPP_TEMPLATE.
renderWhatsAppMessage(template: string | null, items: CartItemLike[]): string
```

- `{itens}` → bloco numerado (a lógica atual de `buildWhatsAppMessage`, extraída para `formatItemsBlock(items)`).
- `{total}` → `formatMoney(total)`.
- `{saudacao}` → saudação padrão (ex.: "Olá! Gostaria de fazer um pedido:").
- Variável desconhecida → mantida literal.
- `DEFAULT_WHATSAPP_TEMPLATE` = template do Escopo §8 usando as três variáveis, garantindo que o fallback produza exatamente o formato atual.

`buildWhatsAppMessage` atual é mantido/reaproveitado internamente para não regредir o formato padrão (os testes existentes continuam válidos).

## Rota, middleware e limpeza

- Criar `app/[slug]/page.tsx` (+ `use-catalogo.ts` e `CatalogoClient.tsx` movidos/adaptados para a nova pasta, recebendo props em vez de importar `lib/data`).
- Página de expiração: componente `components/catalogo/CatalogExpired.tsx` (mensagem + sem link de painel; loja fica oculta).
- **Middleware:** o matcher exclui `catalogo` e `landing`; a rota dinâmica `/{slug}` **não** é redirecionada (o middleware só age em `/login`, `/cadastro`, `/painel`, `/escolha-de-plano`). Um `getUser()` roda por request — inofensivo. Não é necessário alterar o middleware, mas confirmar que `/{slug}` de visitante anônimo passa direto (nenhum redirect). Remover a exclusão obsoleta `catalogo` do matcher ao remover a rota antiga.
- Remover `app/catalogo/` (page/client/hook) após portar. `lib/data.ts` deixa de ser importado pelo catálogo (pode continuar existindo para outros usos mockados do painel, se houver — verificar antes de deletar o arquivo inteiro).

## Componentes — mudanças

| Componente | Mudança |
| ---------- | ------- |
| `StoreHeader`, `ProductCard`, `ProductDetail` | Nenhuma (contrato preservado) |
| `BagDrawer` | `onCheckout` já é injetado; sem mudança estrutural. Estado "sem WhatsApp" tratado no hook/CTA |
| `CatalogoClient` | Recebe `store`, `products`, `categories` via props; remove `import { STORE }`/`PRODUCTS` |
| `use-catalogo` | Recebe dados por parâmetro; `handleCheckout` usa `renderWhatsAppMessage(store.messageTemplate, cart)` e `store.whatsapp`; desabilita se `!store.whatsapp` |

## Arquivos afetados

**Novos**
- `app/[slug]/page.tsx`
- `app/[slug]/CatalogoClient.tsx`
- `app/[slug]/use-catalogo.ts`
- `lib/server/catalog.ts`
- `components/catalogo/CatalogExpired.tsx`
- `supabase/migrations/<ts>_catalog_public_read.sql`
- Testes: `lib/utils.test.ts` (template), `lib/server/catalog.test.ts` (mappers/visibilidade)

**Modificados**
- `lib/utils.ts` (renderWhatsAppMessage + helpers)
- `middleware.ts` (remover exclusão `catalogo` do matcher)

**Removidos**
- `app/catalogo/` (page, CatalogoClient, use-catalogo)

## Estratégia de teste (deriva das ACs)

- `renderWhatsAppMessage`: template custom, template null (fallback = formato §8 exato), variável desconhecida literal, `{itens}` multi-item. → CAT-07, CAT-08
- Mappers `mapPublicProduct`/`mapPublicStore`: cents→string, images vazio→placeholder, category null→"Todos". → CAT-01, CAT-06
- Visibilidade `getPublicCatalog`: `is_active=true` → visível; `is_active=false` → hidden; slug nulo → null. (com client Supabase stubado). → CAT-10, CAT-03
- Filtro de pills: só categorias com produtos visíveis. → CAT-02
- RLS: teste de integração/consulta anon retornando só ativos+em estoque (se o harness local permitir; senão, verificação manual documentada). → CAT-05
