# Degradação por plano: truncamento da vitrine pública e sinalização no painel

**Data:** 2026-07-30
**Status:** Aprovado para planejamento

## Objetivo

Todo limite numérico de plano é hoje aplicado **na escrita e ignorado na leitura pública**. As Server Actions barram a criação acima do teto ([produtos.ts:70](../../../app/actions/produtos.ts), [produtos.ts:297](../../../app/actions/produtos.ts), [categorias.ts:36](../../../app/actions/categorias.ts)), mas nada trata excedente já existente. O efeito prático: uma loja rebaixada continua entregando uma vitrine premium.

Quatro vazamentos concretos:

| Limite | Degradação hoje | Cenário quebrado |
|---|---|---|
| Produtos | nenhuma | Pro com 200 produtos → Free exibe os 200 |
| Fotos | nenhuma ([catalog.ts:114](../../../lib/catalog.ts)) | Free exibe galeria de 5 fotos |
| Destaques | `allowFeatured` é booleano ([catalog.ts:178](../../../lib/catalog.ts)) | Pro com 20 destaques → Starter exibe os 20 |
| Categorias | nenhuma | Free exibe 20 filtros |

Some-se a isso o domínio próprio: [middleware.ts:22](../../../middleware.ts) resolve o host apenas por `custom_domain_verified`, sem olhar plano — o principal diferencial do Pro sobrevive ao rebaixamento, virando compra única.

Isso já está furado hoje, com rebaixamento manual e raro. Vira crítico quando o gateway de pagamento passar a rebaixar automaticamente por falha de cobrança. **Esta spec fecha os furos e não depende de gateway nenhum**; a integração de assinatura é a Spec 2.

Junto vão dois ajustes de plano decididos na mesma rodada: os limites novos do Starter e a liberação da cor secundária para todos os planos.

## Escopo

**Dentro:**
- Módulo novo `lib/plan-visibility.ts`: truncamento puro do catálogo por `PlanLimits` (produtos, categorias, fotos, destaques).
- Ordenação determinística de produtos (`created_at desc, id desc`) no fetch público e no cálculo do painel.
- Migration: função `resolve_custom_domain(p_hostname)` `security definer`, substituindo a query de domínio do middleware.
- Middleware: domínio próprio deixa de resolver quando o plano não inclui `customDomain`, redirecionando 307 para o slug.
- Painel de produtos: banner com contagem de ocultos + selo "Oculto na vitrine" nos cards excedentes.
- `STARTER_LIMITS`: `maxProducts` 30 → 50, `maxCategories` 5 → 7.
- Remoção completa da flag `advancedTheme` — cor secundária disponível em todos os planos, inclusive Free.
- Listas de recursos da landing (`app/landing/data.tsx`) alinhadas aos limites novos.

**Fora desta rodada (Spec 2 — assinatura):**
- Preços visíveis e botão de assinatura na landing; `app/page.tsx` mantém "Sob consulta" e CTA de WhatsApp.
- Página de assinatura; `RecursoBloqueado` e `UpsellHint` continuam apontando para o WhatsApp.
- Modelagem `plan_expires_at` + `subscription_status` substituindo o uso sobrecarregado de `trial_ends_at`.
- Gateway, checkout, webhooks, proporcional no upgrade, cancelamento, período de graça.

**Fora de qualquer rodada:**
- Apagar ou despublicar dados no rebaixamento. O corte é exclusivamente de leitura: nada sai do banco e tudo reaparece no re-upgrade.
- Paginação da vitrine pública. `fetchPublicCatalog` já busca o catálogo inteiro; esta spec não altera isso.

## Contexto que restringe o desenho

Três características do código atual condicionam as decisões abaixo:

1. **O `anon` não tem `select` em `plan`/`trial_ends_at`.** Foi por isso que [`get_effective_plan`](../../../supabase/migrations/20260725100200_get_effective_plan_function.sql) nasceu `security definer`: o `anon` ganha EXECUTE na função, nunca SELECT nas colunas. O middleware não pode simplesmente adicionar `plan` ao seu `select`.
2. **`enforce_admin_only_store_columns`** ([20260728100000](../../../supabase/migrations/20260728100000_lock_admin_only_store_columns.sql)) congela `plan`, `trial_ends_at` e `custom_domain_verified` contra escrita de `authenticated`/`anon`. Esta spec não adiciona colunas, então o trigger não muda — mas a Spec 2 vai precisar estendê-lo.
3. **`now()` é o horário da transação no Postgres.** A importação por CSV insere em lote numa única transação, portanto todas as linhas de um mesmo import compartilham `created_at`. Ordenação por `created_at` sozinha não é estável neste banco.

## Estratégia

### `lib/plan-visibility.ts` (lógica pura, sem I/O)

```ts
export interface VisibleCatalog {
  products: PublicProductRow[];
  categories: PublicCategoryRow[];
}

export function applyPlanVisibility(
  products: PublicProductRow[],
  categories: PublicCategoryRow[],
  limits: PlanLimits
): VisibleCatalog;
```

Sem Supabase, sem React, sem `Date.now()`. Chamado por `resolveCatalog` ([catalog.ts:178](../../../lib/catalog.ts)) antes do mapeamento.

**Pré-condição: `products` chega ordenado.** `PublicProductRow` não tem `created_at` — `PRODUCT_COLS` ([server/catalog.ts:15](../../../lib/server/catalog.ts)) não o seleciona — então a função não ordena nada: ela **preserva a ordem de entrada** e corta. Quem garante a ordem é o `order by` da query, e o painel precisa usar exatamente o mesmo. Adicionar `created_at` ao select só para reordenar em memória seria trabalho duplicado e mais uma coluna pública a manter.

**Produtos.** Os `maxProducts` primeiros da lista recebida. `Infinity` (Pro) devolve a lista original sem cópia.

**Categorias.** Derivadas **dos produtos que sobraram**, preservando `position`, e só então cortadas em `maxCategories`. Cortar a lista de categorias diretamente exibiria filtros que não retornam nada — uma loja Free com 8 produtos mostraria abas vazias, o que lê como bug e não como limite de plano. Produtos cuja categoria não sobreviveu caem em "Todos": basta não incluí-la no `nameById` de `resolveCatalog`, e `mapPublicProduct` já resolve via `categoryName ?? "Todos"`.

**Fotos.** `images.slice(0, maxPhotos)`. `maxPhotos` nunca é zero, então a capa (`images[0]`) sempre sobrevive; o que cai é a galeria.

**Destaques.** Entre os produtos visíveis, os `maxFeaturedProducts` primeiros com `is_featured` **na ordem de entrada** mantêm o selo; nos demais vira `false`. Substitui o `allowFeatured` booleano de [catalog.ts:178](../../../lib/catalog.ts), que hoje é ligado/desligado por `maxFeaturedProducts > 0` e por isso não limita quantidade. Com o Free em zero, nenhum destaque sobrevive.

### Ordenação determinística

`created_at desc, id desc` no `select` de produtos de [server/catalog.ts:56](../../../lib/server/catalog.ts) e na mesma ordenação usada pelo painel para calcular `visibleIds`.

Sem o desempate por `id`, o conjunto dos "50 mais recentes" varia entre requests para produtos importados no mesmo lote de CSV: a vitrine mudaria sozinha entre visitas e o painel marcaria como oculto um produto que a vitrine está exibindo. O desempate é pré-requisito de todo o resto, não um detalhe de implementação.

### `resolve_custom_domain(p_hostname text)`

Migration nova, `security definer`, `stable`, `set search_path = public`, com `grant execute ... to anon`. Devolve `slug`, `custom_domain_verified` e o plano efetivo numa única chamada, aplicando a mesma regra de expiração de `get_effective_plan`.

Substitui a query de [middleware.ts:20-24](../../../middleware.ts) inteira. Mantém uma round-trip — a alternativa (`select` de `id` seguido de RPC `get_effective_plan(id)`) colocaria duas no caminho crítico de todo request de domínio próprio, antes de qualquer byte de HTML. O `anon` continua sem enxergar `plan`, exatamente como no padrão já estabelecido pela função existente.

A função devolve o plano como texto; **a decisão fica em TypeScript**, via `getPlanLimits(plan, null).customDomain`. Nada de `'pro'` hardcoded em SQL: a fonte da verdade continua sendo [plan-limits.ts](../../../lib/plan-limits.ts), e o dia que o domínio próprio virar recurso de Starter nada muda no banco.

### Middleware: três desfechos

| Situação | Hoje | Depois |
|---|---|---|
| Verificado + plano com `customDomain` | rewrite para `/{slug}` | inalterado |
| Verificado + plano sem `customDomain` | rewrite (domínio segue funcionando) | **redirect 307** para `{NEXT_PUBLIC_SITE_URL}/{slug}` |
| Não verificado | rewrite para `/dominio-pendente` | inalterado |

**307, nunca 301.** O rebaixamento é reversível; um 301 fica cacheado no browser do visitante de forma que nem o re-upgrade desfaz — o lojista voltaria a pagar o Pro e continuaria sendo redirecionado. É o tipo de erro que não tem correção em campo.

### Painel: sinalização de ocultos

A listagem é paginada e filtrada ([use-produtos.ts](../../../app/painel/produtos/use-produtos.ts)), então um card não conhece sua posição no ranking global. A página passa a calcular no servidor e repassar ao client:

- `hiddenCount`: `max(0, ativos - maxProducts)`, zero quando o plano não tem teto
- `visibleIds`: os IDs que sobrevivem, na mesma ordenação e com o mesmo filtro da vitrine

**A base de cálculo são os produtos ativos, não o total.** [server/catalog.ts:55](../../../lib/server/catalog.ts) filtra `is_active = true`, então o truncamento incide só sobre eles. Usar o total contaria produtos que já estão fora da vitrine por decisão do lojista e inflaria a contagem. O número sai de `storeTotal - inactive`, contagens que a página já faz — sem query nova. Atenção: o `active` que a página calcula hoje é `is_active AND stock > 0` e **não** serve aqui, porque a vitrine exibe esgotados.

Pelo mesmo motivo, o selo só aparece em produto **ativo** fora de `visibleIds`. Produto inativo já está fora da vitrine pelo toggle do lojista; marcá-lo como limite de plano seria mentira.

`visibleIds` é barato por construção: só existe quando há truncamento, e truncamento só ocorre em plano com teto finito — no máximo 50 IDs. Um card exibe o selo quando seu `id` não está no conjunto, o que funciona igual em qualquer página e sob qualquer filtro.

**Banner** no topo de `ProdutosClient` quando `hiddenCount > 0`: *"N produtos estão ocultos na sua vitrine"* com CTA de upgrade. **Selo** "Oculto na vitrine" nos cards fora de `visibleIds`.

Nesta spec o CTA continua sendo `vtrineWhatsAppHref`, como todo upsell do painel hoje. A Spec 2 troca os destinos de uma vez, quando a página de assinatura existir.

### Limites e cor secundária

`STARTER_LIMITS`: `maxProducts` 30 → **50**, `maxCategories` 5 → **7**. Cerca de sete produtos por categoria — densidade em que o filtro ainda ajuda a navegar. Nenhum outro limite muda.

`advancedTheme` é **removida por completo**, não afrouxada. A flag controla um único ponto ([theme-options.ts:103](../../../lib/theme-options.ts)); fonte, fundo e cantos são governados por `themeOptions`. Some de `PlanLimits`, das três constantes de limite, de `ThemeLimits`, de [store.ts:127](../../../app/actions/store.ts) (grava sem condicional) e de [PersonalizacaoClient.tsx:53,85](../../../app/painel/personalizacao/PersonalizacaoClient.tsx) (campo perde o estado bloqueado).

Vale para o Free também. É coerente com `accent_color`, que nunca foi limitada por plano — cor é identidade de marca, não recurso premium — e vitrines gratuitas mais bonitas funcionam como divulgação da própria Vtrine.

### Landing

Em [app/landing/data.tsx](../../../app/landing/data.tsx): `starterFeatures` recebe "Até 50 produtos" e "7 categorias"; **"Cor secundária exclusiva" sai de `proFeatures`** sem virar bullet do Free. Deixou de ser argumento de venda, e anunciá-la num plano que não personaliza mais nada só confunde — continua disponível no painel para quem quiser usar.

`app/page.tsx` não é tocado nesta spec.

## Tratamento de erro

Falha em `resolve_custom_domain` mantém o comportamento atual de [middleware.ts:26-28](../../../middleware.ts): loga e segue o fluxo normal. A consequência merece ser nomeada — em erro de banco, um domínio próprio exibe a landing da Vtrine. É o comportamento de hoje, e fail-open é preferível a derrubar o site inteiro por uma RPC.

`fetchPublicCatalog` continua lançando em erro de plano, como já faz em [server/catalog.ts:40-43](../../../lib/server/catalog.ts).

`applyPlanVisibility` é total: nunca lança. Entrada vazia devolve saída vazia; `Infinity` devolve tudo.

## Testes

**Novo — `__tests__/plan-visibility.test.ts`** (puro, sem mock):
- Os quatro cortes, isoladamente e combinados.
- Categorias derivadas dos produtos sobreviventes; nenhuma categoria sem produto visível.
- Produto de categoria truncada cai em "Todos".
- Preservação da ordem de entrada (o corte nunca reordena).
- Pro (`Infinity`) não trunca nada.

O determinismo com `created_at` idêntico é propriedade do `order by` da query, não da função pura — ela só preserva o que recebe. Verificar em `catalog.test.ts`, no nível em que a ordenação da query está sob teste.

**Atualizados:**
- `plan-limits.test.ts` — limites novos do Starter; `advancedTheme` fora.
- `catalog.test.ts` — `resolveCatalog` com plano rebaixado, ponta a ponta.
- `middleware.test.ts` — os três desfechos, incluindo o 307 e o status code exato.
- `theme-options.test.ts` — `secondaryColor` preservada em qualquer plano.
- `PersonalizacaoClient.test.tsx` — campo de cor secundária sem estado bloqueado.
- `ProdutosClient.test.tsx` — banner com contagem e selo nos cards fora de `visibleIds`.
- `landing-data.test.ts` — números novos; ausência do bullet de cor secundária.

`ConfiguracoesClient.test.tsx` e `csv-import-limits.test.ts` consomem limites e devem ser conferidos quanto a números fixos.

## Riscos

**Loja rebaixada com catálogo muito grande.** `fetchPublicCatalog` busca todas as linhas para descartar a maioria. É raro por construção (só rebaixadas), `getPublicCatalog` já envolve tudo em `unstable_cache` por slug, e a vitrine pública já busca o catálogo inteiro hoje — nada piora. Se virar problema, aplicar `.limit()` na query é uma otimização posterior que não muda a interface de `applyPlanVisibility`.

**Divergência entre painel e vitrine.** Painel e vitrine calculam o conjunto visível em lugares diferentes. A ordenação determinística é o que mantém os dois de acordo; qualquer mudança futura na ordenação precisa ser feita nos dois pontos ao mesmo tempo.
