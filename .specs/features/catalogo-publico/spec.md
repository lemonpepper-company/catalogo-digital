# Catálogo Público (item 3.3) — Specification

## Problem Statement

As três telas do catálogo público (Home, Detalhe do produto, Sacola drawer) já existem e funcionam, mas consomem dados mockados de `lib/data.ts` numa rota fixa `/catalogo` sem multi-tenancy. O painel do lojista já persiste tudo no Supabase; o catálogo é a última superfície ainda mockada. Precisamos ligá-lo ao banco: servir o catálogo real de cada loja por slug, respeitando visibilidade (esgotados, trial) e o template de WhatsApp configurado.

## Goals

- [ ] Catálogo público servido por slug (`/{slug}`) lendo loja + produtos + categorias reais do Supabase
- [ ] Produtos esgotados/inativos nunca aparecem no catálogo público
- [ ] Catálogo oculto (404 / página de expiração) quando a loja está inativa ou o trial expirou
- [ ] Mensagem de WhatsApp montada a partir do `message_template` configurado pela loja (com fallback para o template padrão)

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Injeção de Google Analytics / Facebook Pixel | Decisão do usuário: fora deste ciclo (item 4.1, tratado depois) |
| Persistência da sacola em localStorage | Sacola vive em estado React no client único; persiste durante a navegação SPA. Persistência entre reloads é V2 |
| Busca de produtos (ícone de lupa no header) | Botão decorativo no mock; busca não está no escopo do V1 3.3 |
| Reativação por pagamento após expiração | Depende de integração de pagamento (roadmap passo 6) |
| Rota `/catalogo` antiga | Substituída por `/{slug}`; ver Assumptions |
| Detalhe do produto como rota própria | Mantém-se overlay in-client para preservar a sacola sem estado global |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Regra de visibilidade do catálogo | Visível quando `store.is_active === true` (trial ignorado por ora) | Confirmado pelo usuário: sem estado de pagamento ainda (roadmap passo 6); catálogos não devem sumir no dia 15 durante desenvolvimento/validação. Cheque de trial volta com pagamento. | y |
| Loja inativa vs slug inexistente | `is_active=false` → página de expiração (não 404). Slug inexistente → 404 real (`notFound()`) | Distinguir "loja existe mas fechada" de "loja não existe" | y |
| Rota do catálogo | `app/[slug]/page.tsx` na raiz; remover `app/catalogo/` mockado | Usuário escolheu `/[slug]` na raiz. Rotas estáticas existentes (`/login`, `/painel`…) têm precedência sobre a dinâmica | n |
| Mapeamento de dados | `StoreProduct`/`StoreRow` (banco) → view-models `Product`/`Store` existentes via mapper; componentes de UI não mudam de contrato | Menor risco: preserva os componentes já validados | n |
| `image` do card/detalhe | Primeira imagem de `images[]`; placeholder se vazio | Contrato `Product` tem `image` único | n |
| Nome da categoria no produto | Resolvido via join `category_id → categories.name`; produtos sem categoria caem em "Todos" apenas | Banco guarda `category_id`, UI filtra por nome | n |
| Pills de categoria | "Todos" fixo primeiro + categorias da loja que tenham ao menos 1 produto visível | Evita pills vazias | n |
| Loja sem WhatsApp configurado | CTA de checkout desabilitado com aviso; não abre `wa.me` inválido | Evita link quebrado | n |
| `stores` já tem leitura pública (`using(true)` + grant anon) | Reusar; migration nova só adiciona policies de `products` e `categories` | Confirmado na migration `init_auth.sql:27` | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Home do catálogo real por slug ⭐ MVP

**User Story**: Como cliente final, quero abrir o link `/{slug}` da loja e ver a vitrine real (marca, produtos ativos, categorias) para escolher peças.

**Why P1**: É a porta de entrada do catálogo; sem ela não há vitrine real.

**Acceptance Criteria**:

1. WHEN um visitante acessa `/{slug}` de uma loja visível THEN o sistema SHALL renderizar header (logo/monograma, nome), pills de categoria e grid dos produtos reais da loja
2. WHEN a loja tem produtos em várias categorias THEN o sistema SHALL exibir pill "Todos" (ativa por padrão) seguida das categorias com produtos visíveis
3. WHEN o visitante seleciona uma pill de categoria THEN o sistema SHALL filtrar o grid para os produtos daquela categoria
4. WHEN o slug não corresponde a nenhuma loja THEN o sistema SHALL responder com 404 (`notFound()`)
5. WHEN a loja não tem nenhum produto visível THEN o sistema SHALL exibir um estado vazio coerente (sem grid quebrado)

**Independent Test**: Semear uma loja + produtos no banco, abrir `/{slug}`, ver os produtos reais e o filtro funcionando.

---

### P1: Ocultar esgotados e inativos ⭐ MVP

**User Story**: Como lojista, quero que peças esgotadas ou desativadas não apareçam no catálogo para não frustrar o cliente.

**Why P1**: Comportamento crítico do Escopo §9.

**Acceptance Criteria**:

1. WHEN um produto tem `stock = 0` THEN o sistema SHALL omiti-lo do catálogo público
2. WHEN um produto tem `is_active = false` THEN o sistema SHALL omiti-lo do catálogo público
3. WHEN um produto tem `stock > 0` E `is_active = true` THEN o sistema SHALL exibi-lo
4. WHEN a query pública roda com o papel `anon` THEN o RLS SHALL retornar apenas produtos com `is_active = true AND stock > 0`

**Independent Test**: Semear produtos com combinações de stock/is_active; confirmar que só os `ativos+em estoque` aparecem — inclusive via consulta direta com a anon key.

---

### P1: Detalhe do produto + adicionar à sacola ⭐ MVP

**User Story**: Como cliente, quero abrir uma peça, escolher tamanho/cor/quantidade e adicioná-la à sacola.

**Why P1**: Passo central da conversão.

**Acceptance Criteria**:

1. WHEN o visitante toca num produto THEN o sistema SHALL abrir o detalhe com foto, nome, preço formatado, variações (tamanhos/cores) e quantidade
2. WHEN o produto exige tamanho (mais de um tamanho) E nenhum foi selecionado THEN o sistema SHALL manter o botão "Adicionar" desabilitado
3. WHEN o visitante adiciona um item THEN o sistema SHALL incluí-lo na sacola, atualizar o badge e abrir o drawer
4. WHEN o mesmo produto+variação é adicionado de novo THEN o sistema SHALL somar as quantidades (limitado ao máximo existente)

**Independent Test**: Abrir um produto real, adicionar com variação, ver badge e item no drawer.

---

### P1: Sacola + checkout WhatsApp com template da loja ⭐ MVP

**User Story**: Como cliente, quero enviar o pedido completo pelo WhatsApp da loja com a mensagem formatada que o lojista configurou.

**Why P1**: É o ponto de conversão — o produto inteiro gira em torno disso.

**Acceptance Criteria**:

1. WHEN a sacola tem itens THEN o drawer SHALL listar itens, variações, subtotais e o total
2. WHEN a loja definiu `message_template` THEN o sistema SHALL renderizar a mensagem substituindo `{saudacao}`, `{itens}` e `{total}`
3. WHEN a loja NÃO definiu `message_template` THEN o sistema SHALL usar o template padrão do Escopo §8
4. WHEN o visitante finaliza THEN o sistema SHALL abrir `https://wa.me/{whatsapp}?text=...` em nova aba com a mensagem URL-encoded
5. WHEN a loja não tem `whatsapp` configurado THEN o sistema SHALL desabilitar o checkout e informar que a loja ainda não configurou o WhatsApp

**Independent Test**: Com template custom e com template nulo, gerar a mensagem e conferir o texto exato; conferir a URL do `wa.me`.

---

### P1: Catálogo oculto quando expirado/inativo ⭐ MVP

**User Story**: Como plataforma, quero ocultar o catálogo de lojas inativas, preservando os dados.

**Why P1**: Comportamento crítico do Escopo §9 (cancelamento → catálogo oculto, dados preservados).

**Acceptance Criteria**:

1. WHEN a loja tem `is_active = true` THEN o sistema SHALL exibir o catálogo normalmente (independente do trial, por ora)
2. WHEN a loja está `is_active = false` THEN o sistema SHALL exibir a página de expiração em vez do catálogo
3. WHEN o catálogo está oculto THEN o sistema SHALL preservar os dados no banco (nenhuma deleção)

**Nota:** o cheque de trial (`isTrialActive`) volta quando a integração de pagamento (roadmap passo 6) existir.

**Independent Test**: Semear loja inativa; confirmar página de expiração e que os dados continuam no banco.

---

## Edge Cases

- WHEN `images` está vazio THEN o sistema SHALL usar placeholder sem quebrar o layout
- WHEN um produto não tem `category_id` THEN o sistema SHALL exibi-lo apenas sob "Todos"
- WHEN uma categoria não tem produtos visíveis THEN o sistema SHALL omitir a pill correspondente
- WHEN o produto tem um único tamanho THEN o sistema SHALL permitir adicionar sem seleção explícita de tamanho
- WHEN `message_template` contém uma variável desconhecida (`{foo}`) THEN o sistema SHALL deixá-la literal (não quebrar)

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| CAT-01 | P1: Home por slug | Design | Pending |
| CAT-02 | P1: Home por slug (filtro/pills) | Design | Pending |
| CAT-03 | P1: Home por slug (404 / vazio) | Design | Pending |
| CAT-04 | P1: Ocultar esgotados/inativos (app) | Design | Pending |
| CAT-05 | P1: Ocultar esgotados/inativos (RLS) | Design | Pending |
| CAT-06 | P1: Detalhe + adicionar | Design | Pending |
| CAT-07 | P1: Sacola + template WhatsApp | Design | Pending |
| CAT-08 | P1: Fallback template + wa.me | Design | Pending |
| CAT-09 | P1: WhatsApp ausente → checkout off | Design | Pending |
| CAT-10 | P1: Visibilidade (trial/inativa) | Design | Pending |

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 10 total, 0 mapped to tasks yet (tasks.md pending)

---

## Success Criteria

- [ ] Abrir `/{slug}` de uma loja real mostra produtos reais do banco (sem `lib/data.ts`)
- [ ] Esgotados/inativos ausentes do público — verificado inclusive por consulta anon direta
- [ ] Mensagem de WhatsApp reflete o template da loja; fallback correto quando nulo
- [ ] Loja expirada/inativa mostra página de expiração; slug inexistente dá 404
- [ ] `npm test` verde; nenhum uso de `lib/data.ts` no caminho do catálogo público
