# Analytics Nativo no Dashboard — Specification

> **Revisão 2026-07-30** (após merge dos PRs #70 e #71 na main): o dashboard passou a ser exclusivo de planos pagos (gate de página inteira) e ganhou filtro de período próprio (`PeriodoFiltro`: hoje/7d/mês/tudo + range customizado, default "mês"). ANL-14/15 foram reescritos para obedecer ao filtro existente, e ANL-20 (capability `hasAnalytics`) foi supersedido pelo gate da página. Aprovado pelo usuário.

## Problem Statement

O plano atual delega prova de ROI ao Google Analytics, mas a persona (dona de boutique) não abre GA. O `DashboardClient` hoje mostra apenas contagem de produtos e os cards de pedidos — não responde "esse sistema está me dando retorno?". Registrar eventos simples no próprio banco (visitas, produtos vistos, cliques em comprar) e exibi-los no dashboard é a mitigação direta do risco de churn do mês 2 apontado no Escopo §10.

## Goals

- [ ] Eventos do catálogo público (`catalog_visit`, `product_view`, `add_to_bag`, `buy_click`) gravados no banco em qualquer plano, sem nunca bloquear a navegação ou a venda
- [ ] Dashboard (exclusivo de Starter/Pro desde o PR #71) mostra visitas, visitantes únicos, produtos mais vistos, cliques em comprar e conversão sacola → pedido, obedecendo ao filtro de período existente (`PeriodoFiltro`)
- [ ] Base de dados pronta para o futuro e-mail semanal ("sua loja teve X visitas e Y pedidos") sem retrabalho de schema

## Out of Scope

| Feature | Reason |
| --- | --- |
| Rate-limit na Server Action de eventos | Adiado por decisão (AD a registrar): dano de abuso é cosmético; gatilho = primeira métrica anômala ou uso dos números em material de cobrança/upsell |
| E-mail semanal de métricas | Ciclo futuro; esta feature só garante que os dados existam |
| Rollup materializado + `pg_cron` + poda de eventos (~90 dias) | Volume de V1 não exige. Upgrade mecânico futuro sem mudança de schema. **Nota para o ciclo futuro:** visitantes únicos não sobrevivem à agregação diária (somar "únicos por dia" superconta); após a poda, únicos e conversão só existem para períodos dentro da janela bruta — aceitável para os presets curtos do filtro; o preset "tudo" passará a ter únicos/conversão limitados à janela bruta. Histórico antigo mantém contagens simples |
| GA / Meta Pixel | Já excluído em AD-004 |
| Breakdown por dispositivo/origem/geo | Exigiria coletar user-agent/IP; contraria a decisão de zero PII |
| Métricas em tempo real / live update | Dashboard lê no server render, como os cards de pedidos hoje |
| Mudanças no `PeriodoFiltro` (novos presets, posição etc.) além de mover para governar as duas seções | O filtro é feature do PR #70; analytics só o consome |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Gate de plano | Captura grava em **todos** os planos; exibição herda o gate de página inteira do dashboard (PR #71: `free` recebe `RecursoBloqueado` antes de qualquer I/O) | Gate próprio da seção ficou redundante; captura universal preserva o histórico para o upgrade (padrão AD-011) | y (revisão 2026-07-30) |
| Período | Seção de analytics obedece ao `PeriodoFiltro` existente (hoje/7d/mês/tudo + `de`/`ate` customizado), default "mês" — mesma fonte `resolvePeriodRange` dos cards de pedidos | Um único filtro governa o dashboard; substituir a decisão anterior (seletor 7/30) evita dois seletores concorrentes | y (revisão 2026-07-30, supersede a escolha "seletor 7/30") |
| Definição de "conversão sacola → pedido" | `pedidos não-cancelados no período` ÷ `visitantes únicos com add_to_bag no período`, em %; divisor 0 → "—"; valor pode exceder 100% (não capar). Numerador reusa `OrderMetrics.ordersThisMonth` (já periodizado e sem `cancelado` pelo mesmo `resolvePeriodRange`) | Fonte de verdade `orders` (AD-010); zero query nova; denominador é o topo do passo "sacola" | y (revisão do design) |
| Dedup de eventos além de `catalog_visit` | Nenhum (sem `client_event_id`) | Duplicata por retry é rara e o dano é cosmético; não vale o custo | y (conversa) |
| Visitante sem storage (modo privado etc.) | `visitor_id` efêmero em memória; contagem de únicos degrada, nada quebra | Alternativa (bloquear registro) perde dados à toa | n (aprovar na revisão da spec) |
| Supabase indisponível no registro | Evento perdido silenciosamente (fire-and-forget, log no servidor) | Espelha AD-008: telemetria nunca bloqueia a venda | y (conversa) |
| "Produtos mais vistos" e produto deletado | Lista considera apenas produtos ainda existentes (`join products`) | Evita "produto removido" na UI; histórico bruto permanece na tabela (`on delete set null`) | n (aprovar na revisão da spec) |
| ~~Gate de capability `hasAnalytics`~~ | **Supersedido (PR #71)**: nenhuma capability nova; o gate de página inteira do dashboard cobre a exibição | Dashboard inteiro é pago; capability por seção viraria código morto | y (revisão 2026-07-30) |
| Consentimento de cookies (banner GA do layout raiz, visível no catálogo) | "rejected" explícito → `visitor_id` **não** é persistido em localStorage (efêmero por página); eventos continuam sendo registrados. `null`/"accepted" → persiste. Dedup de visita em `sessionStorage` mantém-se em todos os casos (funcional, não rastreia entre sessões) | Honra a recusa explícita sem matar a métrica agregada; sem banner configurado (sem `gaId`) consent fica `null` e únicos seguem funcionando | n (aprovar na revisão das tasks) |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Captura de eventos do catálogo público ⭐ MVP

**User Story**: Como lojista, quero que as visitas e interações do meu catálogo sejam registradas automaticamente para que existam dados de retorno mesmo antes de eu olhar o dashboard.

**Why P1**: Sem captura não há nada a exibir; e a captura precisa nascer junto do lançamento para o histórico existir quando o lojista fizer upgrade (mesma lógica de AD-011).

**Acceptance Criteria**:

1. WHEN um visitante abre `/{slug}` pela primeira vez na sessão do navegador THEN o sistema SHALL registrar um evento `catalog_visit` para a loja (dedup por `sessionStorage`, escopado por slug).
2. WHEN o mesmo visitante recarrega ou navega novamente para `/{slug}` na mesma sessão THEN o sistema SHALL NOT registrar novo `catalog_visit`.
3. WHEN o visitante abre o detalhe de um produto (`ProductDetail`) THEN o sistema SHALL registrar `product_view` com o `product_id` do produto.
4. WHEN o visitante adiciona um item à sacola (`handleAdd`) THEN o sistema SHALL registrar `add_to_bag` com o `product_id` do produto adicionado.
5. WHEN o visitante conclui o checkout (`handleCheckout` com WhatsApp configurado e formulário completo) THEN o sistema SHALL registrar `buy_click` (sem `product_id`).
6. WHEN qualquer evento é registrado THEN o payload SHALL conter um `visitor_id` UUID anônimo persistido em `localStorage` — e SHALL NOT conter IP, user-agent ou qualquer PII.
7. WHEN o registro de um evento falha ou demora THEN a navegação e o checkout SHALL prosseguir sem bloqueio, sem mensagem ao visitante, com erro logado apenas no servidor (fire-and-forget; nenhum `await` no caminho crítico do checkout).
8. WHEN a Server Action recebe payload com `event_type` fora da allowlist, slug inexistente, `visitor_id` que não é UUID, ou `product_id` que não pertence à loja THEN o sistema SHALL rejeitar sem gravar nada.
9. WHEN a loja está em qualquer plano (incluindo `free`) THEN a captura SHALL gravar normalmente.
10. WHEN o visitante recusou o banner de consentimento de cookies (`cookie-consent = "rejected"`) THEN o sistema SHALL usar `visitor_id` efêmero (não persistido em `localStorage`) e SHALL continuar registrando os eventos.

**Independent Test**: Navegar na vitrine local (abrir catálogo, ver produto, adicionar à sacola, finalizar) e conferir via SQL que os 4 tipos de evento existem em `catalog_events` com a loja correta; recarregar a página e conferir que `catalog_visit` não duplicou.

---

### P1: Métricas no dashboard (Starter/Pro) ⭐ MVP

**User Story**: Como lojista Starter/Pro, quero ver no dashboard quantas pessoas visitaram meu catálogo, o que mais olharam e quanto disso virou pedido, para saber se o sistema está me dando retorno.

**Why P1**: É a entrega de valor da feature — captura sem exibição não muda a percepção de ROI.

**Acceptance Criteria**:

1. WHEN o lojista Starter/Pro abre o dashboard THEN o sistema SHALL exibir, para o período ativo do filtro: visitas (`catalog_visit`), visitantes únicos (`visitor_id` distintos em `catalog_visit`), cliques em comprar (`buy_click`) e taxa de conversão sacola → pedido (definição na tabela de assumptions).
2. WHEN o lojista Starter/Pro abre o dashboard THEN o sistema SHALL exibir os produtos mais vistos do período (top 5 por contagem de `product_view`, apenas produtos existentes, com nome e contagem).
3. WHEN o dashboard carrega THEN o período das métricas de analytics SHALL vir do `PeriodoFiltro` existente (`resolvePeriodRange` sobre `periodo`/`de`/`ate`; default "mês") — nenhum seletor novo é criado.
4. WHEN o lojista muda o filtro de período THEN as métricas de analytics E os cards de pedidos SHALL refletir o mesmo período (fonte única de range).
5. WHEN o período ativo é "tudo" THEN as métricas SHALL cobrir todo o histórico (consulta sem filtro de data).
6. WHEN não há eventos no período THEN as métricas SHALL exibir zero (e conversão "—"), sem erro e sem esconder a seção.
7. WHEN um lojista autenticado consulta métricas THEN o sistema SHALL retornar apenas dados da própria loja (RLS own-store, mesmo padrão de `orders`).

**Independent Test**: Semear eventos de duas lojas e dois períodos no banco local; logar como uma delas e conferir números por preset do filtro (7d/mês/tudo e um range customizado), incluindo que os dados da outra loja não aparecem.

---

### P2: Gate de plano na exibição (herdado da página — PR #71)

**User Story**: Como lojista Free, não devo ver nenhuma métrica real; ao fazer upgrade, quero encontrar o histórico já capturado.

**Why P2**: O bloqueio em si já existe (gate de página inteira do dashboard); o que esta feature garante é que analytics não vaza por fora dele e que o histórico aparece no upgrade.

**Acceptance Criteria**:

1. WHEN o plano efetivo é `free` THEN o sistema SHALL NOT executar nenhuma query de analytics (o early-return da página, antes de qualquer I/O, permanece o único gate — sem capability nova).
2. WHEN o plano efetivo muda para Starter/Pro (upgrade ou fim de expiração) THEN o dashboard SHALL exibir as métricas reais, incluindo eventos capturados durante o período Free.

**Independent Test**: Alternar `plan`/`trial_ends_at` da loja de teste e conferir página bloqueada (sem query de analytics no mock/log) vs. dashboard real com eventos pré-existentes aparecendo após o "upgrade".

---

## Edge Cases

- WHEN o navegador não tem `localStorage`/`sessionStorage` disponível THEN o sistema SHALL usar `visitor_id` efêmero em memória e registrar normalmente (únicos degradam, nada quebra).
- WHEN um produto com eventos é deletado THEN os eventos SHALL permanecer (`product_id` vira `null`) e o produto SHALL sair de "mais vistos".
- WHEN a conversão excede 100% (mais pedidos que visitantes com sacola) THEN o sistema SHALL exibir o valor calculado sem capar.
- WHEN a leitura de métricas falha no server render THEN o dashboard SHALL renderizar com a seção de analytics em estado vazio/zerado, sem derrubar a página.
- WHEN o visitante finaliza checkout mas `registrarPedido` falha/estoura timeout THEN `buy_click` SHALL ser registrado mesmo assim (funil mede intenção; pedido vem de `orders`).
- WHEN dois eventos idênticos chegam por retry de rede THEN ambos são gravados (sem dedup além de `catalog_visit` — assumption aceita).

## Dimensions sweep (registro)

Input validation → P1-captura AC8. Failure/partial-failure → AC7 + edge cases. Idempotency/dedup → AC1–2 + assumption (sem dedup geral). Auth & rate limits → AC “segurança” em ANL-10/11 (grants) + rate-limit em Out of Scope com gatilho. Concurrency/ordering → N/A because eventos são append-only, sem transição de estado nem ordem relevante. Data lifecycle → Out of Scope com plano de upgrade registrado. Observability → erros de insert logados no servidor (AC7); os eventos são a própria telemetria. External-dependency failure → assumption (evento perdido em silêncio). State-transition integrity → N/A because linhas imutáveis, sem máquina de estados.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ANL-01 | P1 Captura — AC1 visita com dedup de sessão | Tasks | In Tasks |
| ANL-02 | P1 Captura — AC2 recarga não duplica visita | Tasks | In Tasks |
| ANL-03 | P1 Captura — AC3 product_view | Tasks | In Tasks |
| ANL-04 | P1 Captura — AC4 add_to_bag | Tasks | In Tasks |
| ANL-05 | P1 Captura — AC5 buy_click no checkout | Tasks | In Tasks |
| ANL-06 | P1 Captura — AC6 visitor_id anônimo, zero PII | Tasks | In Tasks |
| ANL-07 | P1 Captura — AC7 fire-and-forget, nunca bloqueia | Tasks | In Tasks |
| ANL-08 | P1 Captura — AC8 validação estrita na Server Action | Tasks | In Tasks |
| ANL-09 | P1 Captura — AC9 grava em qualquer plano | Tasks | In Tasks |
| ANL-10 | Segurança — escrita só via service role (`lib/supabase/admin.ts`); `anon` sem nenhum privilégio em `catalog_events` | Tasks | In Tasks |
| ANL-11 | Segurança — grant DML explícito ao `service_role` + guarda no CI (`supabase-migrations-check.yml`), lição de `orders` | Tasks | In Tasks |
| ANL-12 | P1 Dashboard — AC1 métricas do período | Tasks | In Tasks |
| ANL-13 | P1 Dashboard — AC2 top 5 produtos mais vistos | Tasks | In Tasks |
| ANL-14 | P1 Dashboard — AC3 período via `PeriodoFiltro`/`resolvePeriodRange` (default "mês"), sem seletor novo | Tasks | In Tasks |
| ANL-15 | P1 Dashboard — AC4 analytics e cards de pedidos refletem o mesmo período | Tasks | In Tasks |
| ANL-16 | P1 Dashboard — AC6 período vazio → zeros/"—" | Tasks | In Tasks |
| ANL-17 | P1 Dashboard — AC7 RLS own-store na leitura | Tasks | In Tasks |
| ANL-18 | P2 Gate — AC1 free: nenhuma query de analytics (gate de página do PR #71) | Tasks | In Tasks |
| ANL-19 | P2 Gate — AC2 upgrade revela histórico | Tasks | In Tasks |
| ANL-20 | ~~P2 Gate — capability `hasAnalytics`~~ | — | **Superseded (PR #71)** |
| ANL-21 | P1 Captura — AC10 consentimento rejeitado → visitor_id efêmero, eventos seguem | Tasks | In Tasks |
| ANL-22 | P1 Dashboard — AC5 período "tudo" → histórico completo sem filtro de data | Tasks | In Tasks |

**Coverage:** 22 total — 21 ativos mapeados a tasks, 1 superseded (ANL-20), 0 unmapped ✅ (ver Requirement Coverage em `tasks.md`)

---

## Success Criteria

- [ ] Fluxo completo na vitrine local gera os 4 tipos de evento; recarga não duplica visita
- [ ] Dashboard Starter/Pro responde "tive retorno?" em uma tela: visitas, únicos, mais vistos, cliques e conversão, acompanhando o filtro de período existente
- [ ] `free` não executa query de métricas (gate de página); upgrade revela histórico já capturado
- [ ] `has_table_privilege('service_role','public.catalog_events','insert')` = true e `anon` sem privilégio algum — verificado no banco e coberto pelo passo de CI
- [ ] Suíte de testes existente permanece verde; novos testes cobrem os ACs desta spec
