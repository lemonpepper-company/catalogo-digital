# Analytics exclusivo do plano Pro — Context

**Gathered:** 2026-08-03
**Spec:** `.specs/features/analytics-pro-only/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Mover o analytics nativo da vitrine — **captura e exibição** — do estado atual (captura universal + exibição Starter/Pro) para **exclusivo do plano Pro**. Nada mais do dashboard, do schema ou dos grants muda.

---

## Implementation Decisions

### Captura (o "gerar")

- `registrarEvento` passa a resolver o plano efetivo e **não grava** para `free` e `starter`.
- Consequência aceita explicitamente pelo usuário: **loja que assina o Pro começa com o dashboard zerado** — não existe histórico retroativo. Isso supersede a motivação de captura universal herdada de AD-011/ANL-09.
- O gate autoritativo é o do servidor. Qualquer verificação no cliente é otimização de latência, nunca a única defesa (a Server Action é um endpoint público).

### Exibição (o "mostrar")

- Starter vê o bloco `RecursoBloqueado` no lugar de "Sua vitrine em números", com o selo alterado para **"Disponível no plano Pro"** (hoje o selo é texto fixo "Disponível a partir do plano Starter" em `components/painel/RecursoBloqueado.tsx:27`).
- O Starter **não** perde nada além disso: cards de produtos, `PeriodoFiltro`, pedidos e faturamento continuam iguais.
- Free continua bloqueado pela página inteira (PR #71) — nenhuma mudança nesse caminho.
- "Bloqueado por plano" e "não foi possível carregar agora" precisam ser estados distintos na UI: um erro de leitura não pode aparecer como upsell.

### Dados já gravados

- **Nenhuma migration de dados.** As linhas de `catalog_events` de lojas free/starter ficam no banco, inertes.
- Se uma dessas lojas virar Pro, esse histórico antigo aparece — aceito.
- Reversível: se um dia a decisão mudar, os dados ainda estão lá.

### Escopo e marketing

- Só a seção da vitrine muda de plano. Pedidos/faturamento e o acesso ao dashboard continuam Starter+ (AD-011 segue ativo nessa parte).
- `proFeatures` em `app/landing/data.tsx` ganha um item citando métricas de visitas da vitrine. `starterFeatures` não é alterado.

### Agent's Discretion

- Nome e assinatura exatos da capability e do prop novo do `RecursoBloqueado`.
- Como modelar os três estados da seção de analytics no contrato page → client (a spec só exige que "bloqueado" e "indisponível" sejam distinguíveis).
- Se o curto-circuito do cliente (P2) entra neste ciclo ou vira ciclo próprio — recomendação registrada no design.

### Declined / Undiscussed Gray Areas → Assumptions

- **Log da recusa por plano** — não discutido com o usuário; default do agente registrado como assumption na spec (recusa silenciosa, sem `console.error`), com a justificativa de não gerar uma linha de log por visita de loja Free.
- **Curto-circuito no cliente** — não discutido; default do agente é incluir como P2 derrubável, registrado como assumption na spec.

---

## Specific References

- Padrão visual do bloqueio: o próprio dashboard já usa `RecursoBloqueado` dentro da página para os cards de pedidos no Free (`app/painel/DashboardClient.tsx:96`) — é exatamente esse tratamento que o Starter deve ver na seção da vitrine.
- Padrão de capability de plano: `hasOrderHistory`, `csvImport`, `customDomain` em `lib/plan-limits.ts`.
- Padrão de campo derivado de plano no view-model público: `gridDensity` em `mapPublicStore` (`lib/catalog.ts:100`).

---

## Deferred Ideas

- **Backfill / janela de cortesia no upgrade** (ex.: mostrar ao novo Pro os últimos 30 dias mesmo sem captura anterior) — só faria sentido com captura universal; fora do escopo por contradizer a decisão tomada.
- **Poda das linhas antigas de free/starter** — adiada com gatilho ("volume da tabela incomodar"), no espírito de AD-013.
- **E-mail semanal de métricas** — continua no ciclo futuro previsto pela spec original.
