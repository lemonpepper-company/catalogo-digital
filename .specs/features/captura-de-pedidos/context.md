# Captura de Pedidos — Context

**Gathered:** 2026-07-27
**Spec:** `.specs/features/captura-de-pedidos/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Interceptar o payload que o `BagDrawer` já monta no checkout, gravar o pedido (itens, total, pagamento/entrega, nome opcional) em `orders`/`order_items` antes do redirect para `wa.me`, e expor no painel: histórico paginado com detalhe, três cards de ROI no dashboard e marcação de status (pendente/confirmado/cancelado). Sem checkout próprio, sem pagamento, sem CSV, sem impressão.

---

## Implementation Decisions

### Ordem entre gravar e redirecionar (falha/latência)

- A venda nunca é bloqueada pelo registro.
- Aba do WhatsApp é **pré-aberta no clique** (`window.open("", "_blank")`) para escapar do bloqueador de pop-up; a URL `wa.me` é atribuída depois da tentativa de gravação.
- Timeout de **2500 ms** na gravação; estourou ou falhou → abre o WhatsApp igual, erro só no log do servidor, nada aparece para o cliente.
- Se `window.open` retornar `null` (pop-up bloqueado), navega na aba atual.

### Caminho de escrita e segurança

- `SUPABASE_SERVICE_ROLE_KEY` **server-only** (nunca `NEXT_PUBLIC_`), usada por um client Supabase dedicado que só existe em código server.
- `orders` e `order_items` sem nenhum GRANT/policy para `anon` — nem INSERT, nem SELECT. Anon não consegue injetar pedido falso batendo direto na API do Supabase.
- RLS para `authenticated`: lojista lê/atualiza apenas pedidos cuja loja é dele.
- Toda validação (zod), resolução de produtos e cálculo de total acontece na Server Action pública; preço vem sempre de `products.price_cents`.
- Teto anti-abuso: ≥ 20 pedidos da mesma loja nos últimos 60 s → descarta a gravação.

### Dados do cliente

- Um único campo opcional na sacola: "Seu nome (opcional)", máx. 60 caracteres, `trim()`, vazio → `null`.
- Nada de telefone (o WhatsApp já entrega o número).
- O campo nunca bloqueia o botão de envio e não entra no template da mensagem do WhatsApp.

### Escopo do painel

- `/painel/pedidos`: lista paginada (20/página) com data/hora, nome, qtd de itens, total, status; detalhe com itens (nome/tamanho/cor/qtd/unitário/subtotal), pagamento, entrega + endereço, total.
- Dashboard: "Pedidos no mês" (não cancelados), "Vendas confirmadas no mês" (R$, só `confirmado`), "Aguardando confirmação" (todos os `pendente`).
- Status: `pendente` (default na captura) / `confirmado` / `cancelado`; qualquer transição entre os três é permitida para permitir correção.
- Item "Pedidos" no Sidebar e no MobileTabBar.

### Gating por plano (decidido em 27/07/2026, depois da primeira rodada)

- Histórico e cards de ROI: **só a partir do Starter**. Free vê bloqueio.
- **A captura grava em qualquer plano**, inclusive Free — quando o lojista sobe para Starter, o histórico já está cheio e serve de argumento imediato.
- Estado bloqueado: item "Pedidos" continua na navegação em todos os planos; a tela e os cards mostram bloqueio **sem número real** (nenhuma contagem, nenhum total), no padrão do banner de upgrade de `app/painel/layout.tsx:31` (texto + "Falar no WhatsApp →").
- A página do Free **não executa a query** de pedidos — o gate acontece antes do I/O, para nada do histórico chegar ao HTML.
- Gate calculado com `getEffectivePlan(store.plan, store.trialEndsAt)`: Starter/Pro com `trial_ends_at` vencido cai automaticamente para o bloqueio.
- Capability nova em `lib/plan-limits.ts` (`hasOrderHistory`), na mesma estrutura de `PlanLimits` já usada por produtos/categorias/fotos.
- Landing: "Histórico de pedidos" entra em Starter e Pro, **fora** do Free.

### Agent's Discretion

- Forma exata do detalhe do pedido (modal vs. linha expansível), micro-layout dos cards, ícone do item de navegação, texto dos estados vazios — seguindo `docs/DESIGN_SYSTEM.md` e reutilizando `Modal`/`Pagination`/`StatCard` existentes.
- Organização dos módulos puros (`lib/orders.ts`, métricas) e nomes de arquivos, seguindo as convenções do projeto.
- Redação do card da landing, do FAQ e da menção na política de privacidade.

### Declined / Undiscussed Gray Areas → Assumptions

Registrados na tabela **Assumptions & Open Questions** da spec com o default do agente e a justificativa:

- Divergência de preço entre sacola e banco (default: banco vence)
- Item cujo produto não resolve (default: descarta o item, grava o resto; nenhum item resolvido → não grava)
- Chave de idempotência regenerada a cada mudança da sacola
- Corte de mês no fuso `America/Sao_Paulo`
- Retenção indefinida + cascade a partir de `stores`
- Menção na política de privacidade (dado pessoal novo)

---

## Specific References

- O `BagDrawer` já monta a estrutura completa do pedido para a mensagem — a captura reaproveita esse payload, sem duplicar lógica.
- Reuso obrigatório do que existe: `Pagination` + `lib/pagination.ts`, `Modal`, `StatCard`, `formatCents`, `PAYMENT_METHODS`/`DELIVERY_METHODS`, padrão de Server Action de `app/actions/produtos.ts`.
- Padrão de segurança do projeto: coluna pública em `stores` exige GRANT ao `anon` — aqui é o inverso, `orders` **não pode** ter grant para `anon` em nenhuma coluna.

---

## Deferred Ideas

- Exportação CSV do histórico (usuário escolheu status em vez de CSV neste ciclo)
- Impressão/recibo do pedido
- Notificação ao lojista quando um pedido entra
- Gráfico de evolução de vendas / analytics próprio no painel
- Vincular pedido à conversa real do WhatsApp
- Expurgo/anonimização automática de pedidos antigos (LGPD avançado)
