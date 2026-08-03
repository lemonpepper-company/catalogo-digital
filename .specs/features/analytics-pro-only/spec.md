# Analytics exclusivo do plano Pro — Specification

**Tipo:** mudança de escopo sobre a feature já executada `analytics-nativo`
**Spec origem:** `.specs/features/analytics-nativo/spec.md` (executada em 2026-07-30, PR #75)
**Data:** 2026-08-03

---

## Problem Statement

O analytics nativo foi entregue com dois gates diferentes por acidente de composição: a **captura** grava em qualquer plano (ANL-09, por decisão AD-011 "histórico pronto no upgrade") e a **exibição** herdou o gate de página inteira do dashboard, que é Starter/Pro (PR #71). O resultado hoje: loja Free gera eventos que ninguém vê; loja Starter gera e vê as métricas da vitrine. O produto quer o recurso posicionado como diferencial do plano **Pro** — gerar e mostrar apenas no Pro.

## Goals

- [ ] `registrarEvento` grava em `catalog_events` **apenas** quando o plano efetivo da loja é `pro`
- [ ] A seção "Sua vitrine em números" do dashboard aparece **apenas** para `pro`; Starter vê bloco de upgrade, sem nenhuma query de analytics executada
- [ ] O restante do dashboard (produtos, pedidos, faturamento) permanece Starter/Pro, inalterado
- [ ] A página de planos passa a citar métricas de visitas da vitrine como item do Pro

## Out of Scope

| Feature | Reason |
| --- | --- |
| Apagar os eventos já gravados de lojas free/starter | Decisão do usuário (2026-08-03): linhas ficam no banco, inertes. Delete é destrutivo e irreversível; sem gatilho hoje |
| Mover pedidos/faturamento ou o acesso ao dashboard para o Pro | Confirmado pelo usuário: só a seção da vitrine muda de plano. AD-011 (pedidos = Starter+) continua ativo |
| Mudanças no schema de `catalog_events`, nas RPCs de leitura ou nos grants | O gate é de aplicação; nada no banco muda. Grants de `service_role`/`anon` seguem exatamente como estão |
| Rate-limit em `registrarEvento` | Segue adiado por AD-013 — este ciclo não muda o gatilho |
| Retroatividade / backfill de métricas no upgrade | Consequência aceita: ver assumption "histórico no upgrade" |
| Novo texto/telas de upsell além do `RecursoBloqueado` existente e de uma linha na landing | Reuso do padrão do painel; copy nova é ciclo de marketing |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Captura em planos não-Pro | **Não grava nada** — `registrarEvento` resolve o plano efetivo e sai antes do insert | Escolha explícita do usuário (2026-08-03), ciente do custo abaixo | **y** |
| Histórico no upgrade para Pro | Loja que assina o Pro **começa zerada**: só enxerga eventos gerados a partir do momento em que virou Pro | Consequência direta da escolha acima. **Supersede a parte de AD-011 que motivava a captura universal** (ANL-09) | **y** |
| Eventos já gravados de free/starter | Permanecem no banco, inertes. Nenhuma migration de dados | Decisão do usuário; reversível. Se a loja virar Pro esse histórico antigo aparece — aceito | **y** |
| O que o Starter vê no lugar da seção | Bloco `RecursoBloqueado` (cadeado + CTA WhatsApp), com o selo mostrando "Disponível no plano Pro" | Padrão dominante do painel; preserva o upsell. Exige tornar variável o selo hoje fixo em `RecursoBloqueado.tsx:27` | **y** |
| Escopo do dashboard | Só "Sua vitrine em números" muda de plano; pedidos/faturamento e o acesso à página continuam Starter+ | Confirmado pelo usuário | **y** |
| Copy da landing | `proFeatures` ganha um item citando métricas de visitas da vitrine | Confirmado pelo usuário; a copy atual ("Dashboard com métricas de vendas") não fica errada, fica incompleta | **y** |
| Onde vive o gate autoritativo | No **servidor** (`registrarEvento`), sempre. O short-circuit no cliente é otimização, nunca a única defesa | A Server Action é um endpoint público chamável direto; gate só no cliente seria contornável | y (padrão AD-007/AD-012) |
| Curto-circuito no catálogo público (P2) | O catálogo deixa de disparar a action quando a loja não tem `hasAnalytics`, via campo derivado no view-model `Store` | Evita 1–4 round-trips inúteis por visita na maioria das lojas (Free é o plano mais comum). Mesmo padrão de `gridDensity`, que já sai de `limits` em `mapPublicStore` | n (aprovar nesta spec — é o único item derrubável sem perder o objetivo) |
| Recusa por plano no log do servidor | **Não** gera `console.error` — retorna `{ ok: false }` silencioso | É no-op esperado, não falha. Logar como erro poluiria o servidor com uma linha por visita de loja Free | n (aprovar nesta spec) |
| Expiração de trial | Um `pro` com `trial_ends_at` vencido é `free` para todos os efeitos — para de capturar e de exibir | `getEffectivePlan` já é a fonte única disso em todo o projeto | y (comportamento existente) |
| Nome do gate | Nova capability `hasAnalytics` em `PlanLimits` (free `false`, starter `false`, pro `true`) | **Ressuscita ANL-20**, que havia sido supersedido quando o gate coincidia com o da página. Agora o gate é próprio e é lido em 3 lugares — capability evita comparar string de plano espalhada | y (padrão `hasOrderHistory`/`csvImport`) |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Captura exclusiva do Pro ⭐ MVP

**User Story**: Como dono do produto, quero que eventos da vitrine só sejam gravados para lojas Pro, para que o recurso seja de fato um diferencial do plano e a tabela não cresça com dados de quem não paga por ele.

**Why P1**: É a metade "gerar" do pedido; sem ela o Free continua produzindo linhas invisíveis.

**Acceptance Criteria**:

1. WHEN `registrarEvento` recebe um payload válido de uma loja cujo plano efetivo é `free` ou `starter` THEN o sistema SHALL retornar `{ ok: false }` e SHALL NOT executar nenhum `insert` em `catalog_events`.
2. WHEN `registrarEvento` recebe um payload válido de uma loja cujo plano efetivo é `pro` THEN o sistema SHALL gravar o evento exatamente como hoje (mesmo shape de linha: `store_id`, `event_type`, `product_id`, `visitor_id`).
3. WHEN a loja tem `plan = "pro"` ou `"starter"` com `trial_ends_at` já vencido THEN o plano efetivo SHALL ser `free` e a captura SHALL ser recusada (mesma resolução de `getEffectivePlan`).
4. WHEN a captura é recusada por plano THEN o sistema SHALL NOT emitir `console.error` — a recusa é um no-op esperado, não uma falha; os logs de erro existentes (payload inválido, loja inexistente, erro de banco) SHALL permanecer inalterados.
5. WHEN o payload é inválido, a loja não existe ou está inativa THEN o sistema SHALL rejeitar exatamente como hoje, **antes** de qualquer consideração de plano (ordem de validação preservada).
6. WHEN a verificação de plano acontece THEN ela SHALL NÃO adicionar round-trip ao banco — o plano vem da mesma consulta que já busca a loja pelo slug.

**Independent Test**: Chamar `registrarEvento` com a mesma loja em `free`, `starter`, `pro` e `pro` expirado; conferir que só o `pro` vigente produz `insert` e que nenhum `console.error` sai nos casos de recusa por plano.

---

### P1: Exibição exclusiva do Pro ⭐ MVP

**User Story**: Como lojista Starter, ao abrir o dashboard vejo meus pedidos normalmente e, no lugar das métricas da vitrine, um convite claro para o Pro. Como lojista Pro, vejo as métricas como sempre.

**Why P1**: É a metade "mostrar" do pedido, e é onde o Starter percebe o valor do upgrade.

**Acceptance Criteria**:

1. WHEN o plano efetivo é `starter` e o dashboard é renderizado THEN o sistema SHALL NOT chamar `getCatalogAnalytics` (nenhuma RPC de analytics executada, gate antes do I/O — mesmo padrão de ANL-18/ORD-29).
2. WHEN o plano efetivo é `starter` THEN a seção "Sua vitrine em números" SHALL renderizar o bloco `RecursoBloqueado` com o selo "Disponível no plano Pro", e SHALL NOT renderizar nenhum número de visitas, únicos, cliques, conversão ou lista de mais vistos.
3. WHEN o plano efetivo é `pro` THEN o dashboard SHALL exibir as métricas e o top 5 exatamente como hoje, obedecendo ao `PeriodoFiltro` (ANL-12 a ANL-16 e ANL-22 seguem valendo, sem regressão).
4. WHEN o plano efetivo é `pro` e a leitura das métricas falha THEN o dashboard SHALL exibir "Não foi possível carregar agora" — estado **distinto** do bloqueado por plano (um erro nunca pode se disfarçar de upsell, nem o contrário).
5. WHEN o plano efetivo é `starter` THEN os cards de pedidos, faturamento, o `PeriodoFiltro` e os cards de produtos SHALL continuar exibidos exatamente como hoje.
6. WHEN o plano efetivo é `free` THEN a página inteira SHALL continuar bloqueada pelo gate existente do PR #71, sem nenhuma mudança.

**Independent Test**: Renderizar a página do painel com `plan` em `starter` e em `pro`; no `starter` afirmar `expect(getCatalogAnalytics).not.toHaveBeenCalled()` + presença do selo "Disponível no plano Pro" + ausência dos rótulos das métricas; no `pro` afirmar métricas presentes.

---

### P2: Catálogo público não chama a action fora do Pro

**User Story**: Como visitante de uma vitrine Free, não quero pagar latência nem gerar requisições por um recurso que a loja não tem.

**Why P2**: Otimização, não requisito de correção — o gate do servidor já garante o comportamento. Derrubável sem perder o objetivo da feature.

**Acceptance Criteria**:

1. WHEN o catálogo público de uma loja sem `hasAnalytics` é navegado (visita, ver produto, sacola, checkout) THEN o cliente SHALL NOT chamar `registrarEvento`.
2. WHEN o catálogo público de uma loja `pro` é navegado THEN os 4 eventos SHALL ser disparados exatamente como hoje.
3. WHEN o curto-circuito do cliente é removido ou falha THEN o comportamento observável no banco SHALL permanecer correto — o gate do servidor é a garantia (defesa em profundidade, nunca substituição).

**Independent Test**: Montar `CatalogoClient`/`use-catalogo` com uma store sem `hasAnalytics` e percorrer o fluxo; afirmar que `registrarEvento` não foi chamado. Repetir com `hasAnalytics: true` e afirmar as 4 chamadas.

---

### P3: Copy do plano Pro

**User Story**: Como visitante da página de planos, quero ver que as métricas de visita da vitrine são do Pro antes de contratar.

**Why P3**: Alinhamento de marketing; não afeta comportamento do sistema.

**Acceptance Criteria**:

1. WHEN a seção de planos é renderizada THEN a lista do Pro SHALL conter um item citando as métricas de visitas da vitrine, e a lista do Starter SHALL NOT contê-lo.

---

## Edge Cases

- WHEN uma loja `pro` é rebaixada para `starter` THEN a captura SHALL parar imediatamente na próxima visita e o histórico já gravado SHALL permanecer no banco, invisível — voltando a aparecer se a loja retornar ao Pro.
- WHEN uma loja `starter` que acumulou eventos antes desta mudança vira `pro` THEN o dashboard SHALL exibir esse histórico antigo normalmente (linhas mantidas inertes, assumption confirmada).
- WHEN a consulta da loja em `registrarEvento` falha (erro de banco) THEN o sistema SHALL retornar `{ ok: false }` e logar o erro como hoje — a falha de leitura não SHALL ser confundida com recusa por plano.
- WHEN o `product_id` do payload é de outra loja E o plano é `free` THEN qualquer uma das duas recusas é suficiente; o sistema SHALL NOT gravar (ordem entre elas é irrelevante para o resultado).
- WHEN uma requisição chama `registrarEvento` diretamente (fora do catálogo, ignorando o cliente) para uma loja não-Pro THEN o sistema SHALL recusar — o gate do servidor não depende do cliente.

## Dimensions sweep (registro)

Input validation → P1-captura AC5 (ordem de validação preservada; zod inalterado). Failure/partial-failure → AC4 + edge case de erro de banco: recusa por plano ≠ falha de leitura. Idempotency/dedup → N/A because o gate é leitura pura, sem efeito colateral, e a captura segue append-only. Auth boundaries & rate limits → gate autoritativo no servidor (assumption) + P2 AC3; rate-limit segue em Out of Scope por AD-013. Concurrency/ordering → N/A because nada de novo é escrito e não há transição de estado. Data lifecycle → linhas antigas mantidas inertes (assumption + Out of Scope), com edge case de rebaixamento/upgrade descrito. Observability → AC4 (recusa silenciosa, erros reais seguem logando). External-dependency failure → inalterado: fire-and-forget de ANL-07 continua valendo. State-transition integrity → N/A because não há máquina de estados; a única "transição" é o plano, resolvido por `getEffectivePlan` a cada chamada.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| APO-01 | P1 Captura — AC1 free/starter não gravam | Tasks | Pending |
| APO-02 | P1 Captura — AC2 pro grava como hoje | Tasks | Pending |
| APO-03 | P1 Captura — AC3 trial vencido = free, recusa | Tasks | Pending |
| APO-04 | P1 Captura — AC4 recusa por plano não vira log de erro | Tasks | Pending |
| APO-05 | P1 Captura — AC5 ordem de validação preservada | Tasks | Pending |
| APO-06 | P1 Captura — AC6 sem round-trip extra (plano na mesma query da loja) | Tasks | Pending |
| APO-07 | Capability — `hasAnalytics` em `PlanLimits` (free/starter false, pro true); ressuscita ANL-20 | Tasks | Pending |
| APO-08 | P1 Dashboard — AC1 starter não executa query de analytics | Tasks | Pending |
| APO-09 | P1 Dashboard — AC2 starter vê `RecursoBloqueado` com selo "Disponível no plano Pro" | Tasks | Pending |
| APO-10 | P1 Dashboard — AC3 pro sem regressão (ANL-12..16, ANL-22) | Tasks | Pending |
| APO-11 | P1 Dashboard — AC4 bloqueado ≠ indisponível | Tasks | Pending |
| APO-12 | P1 Dashboard — AC5 pedidos/faturamento/filtro intactos no starter | Tasks | Pending |
| APO-13 | P1 Dashboard — AC6 free segue bloqueado pela página (PR #71) | Tasks | Pending |
| APO-14 | P2 Cliente — AC1/AC2 catálogo só dispara evento com `hasAnalytics` | Tasks | Pending |
| APO-15 | P2 Cliente — AC3 servidor continua sendo a garantia | Tasks | Pending |
| APO-16 | P3 Copy — item de métricas da vitrine em `proFeatures` | Tasks | Pending |

**Coverage:** 16 total — preenchido em `tasks.md`.

---

## Impacto na spec `analytics-nativo` (o que fica obsoleto)

| ID original | Situação após esta mudança |
| --- | --- |
| ANL-09 ("grava em qualquer plano, inclusive free") | **Supersedido por APO-01/APO-02.** Passa a valer: grava apenas no `pro` |
| ANL-18 ("free: nenhuma query de analytics") | **Ampliado por APO-08**: agora vale para free **e** starter |
| ANL-19 ("upgrade revela histórico") | **Reinterpretado por APO-03 + edge cases**: só revela histórico se ele existir — o que, com captura Pro-only, é o caso apenas de rebaixamento/re-upgrade ou de linhas anteriores a esta mudança |
| ANL-20 (capability `hasAnalytics`, marcado "Superseded (PR #71)") | **Ressuscitado por APO-07** — o gate voltou a ser próprio da seção, não coincide mais com o gate da página |
| AD-011 (parte "captura grava em qualquer plano") | Precisa de decisão nova em `.specs/STATE.md` que superseda esse trecho para analytics (a parte sobre pedidos continua ativa) |

Todos esses pontos serão anotados na spec original com referência a este documento (task de fechamento).

---

## Success Criteria

- [ ] Loja `free` e `starter` navegando na vitrine não produzem **nenhuma** linha nova em `catalog_events`; loja `pro` produz as 4
- [ ] Dashboard `starter` renderiza sem nenhuma chamada a `getCatalogAnalytics` e com o selo "Disponível no plano Pro"
- [ ] Dashboard `pro` idêntico ao de hoje (nenhum teste existente de analytics precisou ser afrouxado ou removido)
- [ ] Cards de pedidos e `PeriodoFiltro` do `starter` inalterados
- [ ] Suíte ≥ 956 testes verdes (baseline 2026-08-03: 83 arquivos / 956 testes) + os novos desta spec
