# Captura de Pedidos — Specification

## Problem Statement

Hoje o pedido nasce e morre no WhatsApp: o `BagDrawer` monta a mensagem, o cliente é redirecionado para `wa.me` e o sistema nunca sabe que a venda existiu. O lojista não tem nenhuma prova de que a Vtrine gerou receita — o argumento nº 1 para renovar a assinatura simplesmente não existe. Este ciclo intercepta o payload que já é montado no checkout, registra o pedido no banco antes do redirect e expõe no painel o histórico e os números de faturamento.

## Goals

- [ ] Todo envio de pedido pela sacola grava uma linha em `orders` (+ itens) com valores calculados no servidor, sem nunca bloquear o redirect para o WhatsApp
- [ ] O lojista abre `/painel/pedidos` e vê o histórico completo da própria loja, com detalhe item a item
- [ ] O dashboard mostra "Pedidos no mês", "Vendas confirmadas no mês (R$)" e "Aguardando confirmação" — prova de ROI direta
- [ ] O lojista marca cada pedido como Confirmado / Cancelado / Pendente, e o faturamento conta apenas os confirmados
- [ ] Histórico e números de ROI são exclusivos de Starter/Pro; Free vê a tela bloqueada com CTA de upgrade — mas o pedido dele continua sendo gravado
- [ ] Nome do cliente é obrigatório e, junto com um código curto do pedido, viaja na mensagem do WhatsApp — o lojista localiza a venda no painel por código ou nome
- [ ] Landing page e documentação passam a comunicar o recurso como diferencial dos planos pagos

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Motivo |
|---|---|
| Checkout próprio / pagamento no site | Vira marketplace — decisão de produto já registrada no Escopo §5 |
| Exportação CSV do histórico | Depende do histórico existir; fica para o ciclo seguinte (usuário optou por status, não por CSV) |
| Impressão / recibo de pedido | Mesma razão — V2 depois deste ciclo |
| Notificação de novo pedido (email/push/WhatsApp para o lojista) | Exige provedor de envio e configuração; não é necessário para provar ROI |
| Gráfico de evolução de vendas / analytics próprio | Cards de contagem e soma já entregam a prova de ROI; gráfico é outra feature |
| Vínculo do pedido com a conversa real do WhatsApp (confirmação automática) | Impossível sem API oficial do WhatsApp Business |
| Estoque decrementado no pedido | Pedido é intenção de compra, não venda confirmada; mexer em estoque aqui gera inconsistência |
| Edição de itens/valores de um pedido já gravado | Pedido é registro histórico; só o status muda |

---

## Assumptions & Open Questions

Toda ambiguidade está resolvida aqui — nada fica silenciosamente indefinido.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Falha/lentidão na gravação | Timeout de 2500 ms; WhatsApp abre de qualquer forma, erro só no log do servidor | A venda nunca pode ser perdida por causa do registro | y (usuário) |
| Como o pedido é gravado | `SUPABASE_SERVICE_ROLE_KEY` **server-only**; `orders`/`order_items` sem nenhum GRANT para `anon` | Server Action pública validando tudo; anon não consegue injetar pedido falso direto na API do Supabase | y (usuário) |
| Dados do cliente | "Seu nome" **obrigatório** (mín. 2 e máx. 60 caracteres após `trim()`); sem telefone | Revisado em 28/07/2026: o nome viaja na mensagem para o lojista casar a conversa com o registro. Telefone segue desnecessário — o WhatsApp já entrega o número | y (usuário, ciclo 2) |
| Identificador do pedido na mensagem | Código curto de 6 caracteres derivado do `client_order_id`: **gerado no cliente** para a mensagem e **derivado de novo no servidor** para gravar em `orders.code` (o payload não carrega o código) | Um código vindo do servidor exigiria esperar a resposta para montar a mensagem — no timeout de 2500 ms ou numa falha o pedido iria sem código, quebrando AD-008. Custo aceito: não é sequencial | y (usuário, ciclo 2) |
| Template customizado das lojas existentes | Ganham as variáveis `{nome}`/`{pedido}` mas **não** são reescritos; sem anexo automático | Escolha explícita do usuário: template é conteúdo do lojista. Quem quiser o formato novo clica em "Restaurar padrão" | y (usuário, ciclo 2) |
| Formato padrão da mensagem | `buildWhatsAppMessage` (lojas com `message_template` nulo) **e** `MSG_DEFAULT` (textarea + "Restaurar padrão") passam a incluir nome e código, e precisam ficar idênticos | São duas fontes do mesmo formato, sincronizadas na mão hoje. Divergir faria "loja nova" e "restaurar" produzirem mensagens diferentes | n (default do agente) |
| Busca no histórico | Campo único que filtra por código **ou** nome do cliente, no servidor, dentro da loja | Localizar o pedido é o objetivo da mudança; com 20 por página, exibir o código sem busca não resolve | y (usuário, ciclo 2) |
| Pedidos gravados antes desta mudança | Migration nova adiciona `code` e faz backfill a partir do `client_order_id`; nada é reescrito à mão | Migration já aplicada nunca é editada (padrão do projeto). Em produção a tabela ainda não existe, então o backfill é só para o ambiente local | n (default do agente) |
| Escopo do painel | Histórico + cards de ROI + status da venda | Escolha explícita do usuário | y (usuário) |
| Disponibilidade por plano | Visualização (histórico + cards de ROI) só a partir do **Starter**; Free vê tela bloqueada com CTA de WhatsApp | Diferencial de plano pago, alinhado ao pacote de diferenciação já em curso | y (usuário) |
| Captura numa loja Free | **Grava normalmente** em qualquer plano — só a visualização é travada | Ao subir para Starter o lojista encontra o histórico já cheio ("você já gerou R$ X"); custo zero e conversão muito mais forte | y (usuário) |
| Estado bloqueado no Free | Item "Pedidos" continua na navegação; tela e cards mostram bloqueio **sem número real**, no padrão do banner de upgrade já existente (`app/painel/layout.tsx:31`) | O recurso precisa ser visível para converter, mas nenhum dado do histórico pode vazar antes do upgrade | y (usuário) |
| Expiração de Starter/Pro liberado manualmente | Acesso cai para o estado bloqueado automaticamente via `getEffectivePlan()` | Mesma regra já usada nos limites de produtos/categorias — sem job, calculado a cada checagem | n (default do agente) |
| Fonte de verdade do preço | `products.price_cents` no momento da gravação; preço enviado pelo cliente é ignorado | Cliente pode adulterar o payload; se o preço mudou depois de o item entrar na sacola, o banco vence (pequena divergência possível vs. mensagem do WhatsApp) | n (default do agente) |
| Item cujo produto não resolve (deletado/inativo/de outra loja) | Item é descartado e o pedido grava os itens restantes; se nenhum item resolve, nada é gravado | Preserva o pedido parcial em vez de perdê-lo por uma edição concorrente do lojista | n (default do agente) |
| Chave de idempotência | `client_order_id` (uuid) gerado no cliente, regenerado sempre que a sacola muda; `unique(store_id, client_order_id)` + insert idempotente | Duplo clique / retry não duplica; reenvio da mesma sacola inalterada também não (trade-off aceito: pedido repetido idêntico é raro) | n (default do agente) |
| Corte de "mês corrente" | Do dia 1 às 00:00 no fuso `America/Sao_Paulo` até agora | Lojista brasileiro lê o mês no fuso dele, não em UTC | n (default do agente) |
| Retenção | Pedidos guardados indefinidamente; `on delete cascade` a partir de `stores` | Histórico é o ativo do recurso; expurgo/anonimização automática é outro ciclo | n (default do agente) |
| Anti-abuso | Descarta gravação quando a loja já recebeu ≥ 20 pedidos nos últimos 60 s | Endpoint é público; teto barato via contagem no banco, sem estado em memória (serverless) | n (default do agente) |
| LGPD | Política de privacidade passa a mencionar armazenamento de nome/itens do pedido | Passa a existir dado pessoal novo (nome informado pelo cliente) | n (default do agente) |
| Card do WhatsApp na sacola | Aba do WhatsApp é pré-aberta no clique (`window.open("", "_blank")`) e só depois recebe a URL | Sem isso, o `await` da gravação faz o pop-up ser bloqueado (Safari/iOS) | n (default do agente) |
| Formato do dinheiro nas telas de pedido (ORD-18) | O de `formatCents` (`lib/utils.ts`): `R$ 1234,50` — **sem separador de milhar** | É o formatador pré-existente do projeto, já usado nos preços de produto e nos cards do painel; a spec só pede "formatada em reais". Mudar `formatCents` aqui mexeria em toda a vitrine e todo o painel — separador de milhar é decisão de produto, registrada em Deferred Ideas do `context.md` | n (registrado em 28/07/2026, depois do spec-precision gap apontado na validação) |

**Open questions:** nenhuma — tudo resolvido ou registrado acima.

---

## User Stories

### P1: Pedido registrado antes do WhatsApp ⭐ MVP

**User Story**: Como lojista, quero que todo pedido enviado pela sacola fique gravado no sistema, para eu ter registro da venda mesmo que a conversa no WhatsApp se perca.

**Why P1**: É a base de tudo — sem a captura não existe histórico nem número de ROI.

**Acceptance Criteria**:

1. WHEN o cliente clica "Enviar pedido via WhatsApp" com sacola não vazia e loja com WhatsApp configurado THEN o sistema SHALL gravar 1 linha em `orders` (status `pendente`) + 1 linha em `order_items` por item resolvido, e SHALL abrir a URL `wa.me` independentemente do resultado da gravação.
2. WHEN o payload chega no servidor THEN o sistema SHALL calcular `order_items.unit_price_cents` e `orders.total_cents` exclusivamente a partir de `products.price_cents` no banco, ignorando qualquer valor monetário vindo do cliente.
3. WHEN a gravação falha (erro de banco/rede) ou excede 2500 ms THEN o sistema SHALL abrir o WhatsApp normalmente, SHALL logar o erro no servidor via `console.error` e SHALL NOT exibir mensagem de erro ao cliente.
4. WHEN o mesmo `client_order_id` é enviado mais de uma vez para a mesma loja THEN o total de pedidos gravados SHALL permanecer 1 e a resposta SHALL ser de sucesso.
5. WHEN o conteúdo da sacola muda (item adicionado, removido ou quantidade alterada) THEN um novo `client_order_id` SHALL ser gerado para o próximo envio.
6. WHEN um item referencia produto inexistente, de outra loja ou com `is_active = false` THEN o item SHALL ser descartado e o pedido gravado com os itens restantes; WHEN nenhum item resolve THEN nenhum pedido SHALL ser gravado.
7. WHEN o payload tem mais de 20 linhas de item, `qty` fora de 1..99, `client_order_id` que não é uuid, slug inexistente, loja com `is_active = false`, ou método de pagamento/entrega fora de `PAYMENT_METHODS`/`DELIVERY_METHODS` THEN o sistema SHALL rejeitar sem gravar nada e retornar `{ ok: false }`.
8. WHEN a loja já recebeu 20 ou mais pedidos nos últimos 60 segundos THEN o sistema SHALL descartar a gravação retornando `{ ok: false }`, sem afetar o redirect.

**Independent Test**: enviar um pedido em `/{slug}` e conferir em `orders`/`order_items` a linha gravada com total calculado do banco; repetir o envio da mesma sacola e confirmar que continua 1 pedido.

---

### P1: Nome obrigatório do cliente na sacola ⭐ MVP

> **Revisão de 28/07/2026 (ciclo 2):** o nome era opcional e não entrava na mensagem. Passou a ser obrigatório e a viajar no WhatsApp junto com o código do pedido, para o lojista localizar a venda no painel. ACs 1–5 abaixo substituem as anteriores.

**User Story**: Como lojista, quero que todo pedido chegue com o nome de quem comprou, para identificar a venda sem depender da conversa.

**Why P1**: Sem nome o histórico lista pedidos anônimos; e sem nome na mensagem o lojista não liga a conversa ao registro.

**Acceptance Criteria**:

1. WHEN a sacola tem itens THEN o `BagDrawer` SHALL exibir o campo obrigatório "Seu nome", com `maxLength` de 60.
2. WHEN o cliente preenche o nome THEN o valor SHALL ser gravado em `orders.customer_name` com `trim()` aplicado e limitado a 60 caracteres.
3. WHEN o campo está vazio, contém apenas espaços, ou tem menos de 2 caracteres após `trim()` THEN o botão "Enviar pedido via WhatsApp" SHALL ficar desabilitado e a sacola SHALL exibir "Informe seu nome para continuar" (mesmo padrão de bloqueio já usado para pagamento e entrega).
4. WHEN o payload chega ao servidor sem nome válido (vazio, espaços ou menos de 2 caracteres após `trim()`) THEN o sistema SHALL rejeitar sem gravar nada, retornando `{ ok: false }` — `orders.customer_name` nunca é `null`.
5. WHEN o pedido é enviado THEN a mensagem do WhatsApp SHALL conter o nome informado e o código do pedido (ver ORD-31..34).

**Independent Test**: com o campo vazio, o botão está desabilitado e a mensagem de bloqueio aparece; preencher "Ana" habilita, e o envio grava `customer_name = 'Ana'` com o nome visível na mensagem.

---

### P1: Código do pedido na mensagem e localização no painel ⭐ MVP

> **Adicionada no ciclo 2 (28/07/2026).** O lojista recebia a mensagem no WhatsApp sem nenhuma forma de casar aquela conversa com a linha do histórico.

**User Story**: Como lojista, quero que a mensagem do WhatsApp traga um código do pedido, para eu achar exatamente aquele pedido na tela de Pedidos.

**Why P1**: Sem isso o histórico existe mas não é acionável na hora da conversa — que é quando o lojista precisa dele.

**Acceptance Criteria**:

1. WHEN o cliente envia o pedido THEN o cliente SHALL gerar um código de 6 caracteres (`[A-Z0-9]`) derivado do `client_order_id` e SHALL incluí-lo na mensagem do WhatsApp; o servidor SHALL **derivar o mesmo código independentemente** a partir do `client_order_id` recebido e gravá-lo em `orders.code`. O payload SHALL NOT carregar o código — nada vindo do cliente é gravado nesse campo, e a derivação determinística garante que mensagem e banco coincidem.
2. WHEN o mesmo `client_order_id` é reenviado THEN o código SHALL ser idêntico (derivação determinística) — reenvio da mesma sacola não gera código novo.
3. WHEN a gravação falha ou estoura o timeout THEN a mensagem do WhatsApp SHALL continuar contendo nome e código (a geração não depende do servidor — AD-008 preservada).
4. WHEN a loja tem `message_template` nulo (loja nova) THEN o formato padrão SHALL incluir o nome do cliente e o código do pedido.
5. WHEN o lojista clica "Restaurar padrão" nas configurações THEN o template restaurado SHALL incluir `{nome}` e `{pedido}`, e SHALL ser idêntico ao formato produzido para `message_template` nulo.
6. WHEN a loja já tem um template customizado THEN ele SHALL ser preservado como está — sem reescrita e sem anexo automático de código.
7. WHEN o lojista edita o template THEN as variáveis `{nome}` e `{pedido}` SHALL estar disponíveis como chips clicáveis e SHALL ser renderizadas no preview.
8. WHEN uma variável não é usada no template THEN ela SHALL ser resolvida como hoje (sem sobra de linha em branco).
9. WHEN o lojista abre `/painel/pedidos` THEN cada linha da lista e o detalhe SHALL exibir o código do pedido.
10. WHEN o lojista digita um código (completo ou parcial) ou parte do nome do cliente no campo de busca THEN a lista SHALL exibir apenas os pedidos da própria loja que casam, case-insensitive, com a paginação recalculada sobre o resultado filtrado.
11. WHEN a busca não encontra nada THEN a tela SHALL exibir estado vazio de busca, distinto do estado "nenhum pedido ainda".
12. WHEN a busca está preenchida e o plano efetivo é `free` THEN o bloqueio de ORD-28 SHALL continuar valendo — nenhuma query é executada.

**Independent Test**: enviar um pedido, copiar o código da mensagem do WhatsApp, colar na busca de `/painel/pedidos` e cair exatamente naquele pedido.

---

### P1: Histórico de pedidos no painel ⭐ MVP

**User Story**: Como lojista, quero abrir uma tela com todos os meus pedidos e ver o detalhe de cada um, para acompanhar as vendas que a vitrine gerou.

**Why P1**: É a superfície onde o valor capturado fica visível.

**Acceptance Criteria**:

1. WHEN o lojista autenticado acessa `/painel/pedidos` THEN o sistema SHALL listar apenas os pedidos da própria loja, ordenados por `created_at` decrescente, exibindo data/hora, nome do cliente (ou "Sem nome"), quantidade de itens, total formatado em reais e o status.
2. WHEN a loja tem mais de 20 pedidos THEN a lista SHALL paginar em páginas de 20 reutilizando o componente `Pagination`.
3. WHEN o lojista abre o detalhe de um pedido THEN o sistema SHALL exibir cada item com nome, tamanho, cor, quantidade, valor unitário e subtotal, além de forma de pagamento, forma de entrega (com endereço quando `entrega`), total e status.
4. WHEN a loja não tem nenhum pedido THEN a tela SHALL exibir estado vazio explicando que os pedidos aparecem ali quando um cliente envia a sacola.
5. WHEN um usuário não autenticado acessa `/painel/pedidos` THEN o middleware SHALL redirecionar para `/login?next=/painel/pedidos`.
6. WHEN o lojista está no painel THEN o item "Pedidos" SHALL aparecer na navegação do Sidebar (desktop) e do MobileTabBar (mobile) **em qualquer plano**, marcado como ativo em `/painel/pedidos`.
7. WHEN o produto de um item foi excluído depois do pedido THEN o detalhe SHALL continuar exibindo nome e valor unitário gravados no momento do pedido (snapshot).

**Independent Test**: com 21 pedidos semeados, abrir `/painel/pedidos`, conferir 20 na primeira página, abrir um detalhe e ver os itens; conferir que pedidos de outra loja não aparecem.

---

### P1: Números de ROI no dashboard ⭐ MVP

**User Story**: Como lojista, quero ver quantos pedidos e quanto em reais a vitrine gerou no mês, para decidir que vale continuar pagando.

**Why P1**: É literalmente o argumento de renovação.

**Acceptance Criteria**:

1. WHEN o lojista abre `/painel` THEN o dashboard SHALL exibir o card "Pedidos no mês" com a contagem de pedidos da loja criados no mês corrente (fuso `America/Sao_Paulo`) cujo status é diferente de `cancelado`.
2. WHEN o lojista abre `/painel` THEN o dashboard SHALL exibir o card "Vendas confirmadas no mês" com a soma de `total_cents` dos pedidos da loja criados no mês corrente com status `confirmado`, formatada em reais.
3. WHEN o lojista abre `/painel` THEN o dashboard SHALL exibir o card "Aguardando confirmação" com a contagem de todos os pedidos da loja com status `pendente`, sem filtro de período.
4. WHEN a loja não tem pedidos no mês THEN os cards SHALL exibir `0` e `R$ 0,00` — nunca vazio, `NaN` ou erro.
5. WHEN um pedido é marcado como `cancelado` THEN ele SHALL deixar de contar em "Pedidos no mês" e SHALL NOT somar em "Vendas confirmadas no mês".

**Independent Test**: semear pedidos com status e datas variadas (mês atual e mês anterior) e conferir os três números contra o cálculo esperado.

---

### P2: Status da venda

**User Story**: Como lojista, quero marcar cada pedido como confirmado ou cancelado, para o faturamento do painel refletir só as vendas que realmente fechei.

**Why P2**: A captura e o histórico já entregam valor sozinhos; o status é o que dá precisão ao número de faturamento.

**Acceptance Criteria**:

1. WHEN o lojista aciona a mudança de status de um pedido para `pendente`, `confirmado` ou `cancelado` THEN o sistema SHALL persistir o novo status e a lista SHALL refletir a mudança sem recarregamento manual da página.
2. WHEN qualquer um dos três status é escolhido, partindo de qualquer status atual THEN a transição SHALL ser aceita (correção de erro é sempre possível).
3. WHEN o valor de status enviado está fora de `{pendente, confirmado, cancelado}` THEN a Server Action SHALL retornar `{ error }` e SHALL NOT alterar nenhuma linha.
4. WHEN o pedido informado não pertence à loja do usuário autenticado THEN nenhuma linha SHALL ser alterada e a action SHALL retornar `{ error }`.
5. WHEN o status muda THEN os cards de ROI do dashboard SHALL refletir o novo valor na próxima renderização (`revalidatePath`).

**Independent Test**: marcar um pedido como confirmado e ver "Vendas confirmadas no mês" subir pelo total dele; cancelar e ver os dois cards caírem.

---

### P1: Histórico como recurso dos planos pagos ⭐ MVP

**User Story**: Como dono do produto, quero que o histórico e os números de faturamento sejam exclusivos de Starter/Pro, para o recurso virar motivo concreto de upgrade — sem deixar de gravar os pedidos de quem está no Free.

**Why P1**: Sem o gate, o principal argumento de upgrade nasce de graça. E se o Free não gravar, o lojista que faz upgrade começa sem prova de ROI.

**Acceptance Criteria**:

1. WHEN um pedido é enviado THEN ele SHALL ser gravado independentemente do plano da loja (Free incluído) — a captura nunca consulta plano.
2. WHEN o plano efetivo da loja é `free` e o lojista acessa `/painel/pedidos` THEN a tela SHALL exibir o estado bloqueado ("Disponível a partir do plano Starter" + link de WhatsApp no padrão do banner de upgrade existente), SHALL NOT listar nenhum pedido e SHALL NOT exibir contagem, total ou qualquer dado real do histórico.
3. WHEN o plano efetivo da loja é `free` THEN a página `/painel/pedidos` SHALL NOT executar a query de pedidos (nenhum dado do histórico chega ao HTML/rede).
4. WHEN o plano efetivo da loja é `free` e o lojista abre `/painel` THEN os três cards de ROI SHALL ser substituídos por um aviso de bloqueio com CTA, sem nenhum número real; os cards de produtos SHALL continuar como hoje.
5. WHEN o plano efetivo da loja é `starter` ou `pro` THEN histórico, detalhe, status e cards de ROI SHALL funcionar integralmente.
6. WHEN uma loja `starter`/`pro` liberada manualmente tem `trial_ends_at` vencido THEN `getEffectivePlan()` SHALL rebaixá-la para `free` e o acesso SHALL cair para o estado bloqueado, sem nenhuma escrita no banco.
7. WHEN o plano efetivo muda de `free` para pago THEN todo o histórico gravado durante o período Free SHALL aparecer imediatamente, sem migração de dados.

**Independent Test**: com a loja em `plan='free'`, enviar um pedido pelo catálogo (linha gravada em `orders`), abrir `/painel/pedidos` e ver só o bloqueio; mudar `plan` para `starter` no Supabase, recarregar e ver o pedido listado.

---

### P2: Landing page e documentação comunicando o recurso

**User Story**: Como visitante da landing, quero saber que meus pedidos ficam registrados no painel, para entender que a Vtrine é mais que um catálogo bonito.

**Why P2**: Não bloqueia a captura, mas é o que transforma o recurso em argumento de venda.

**Acceptance Criteria**:

1. WHEN o visitante lê a seção de recursos da landing THEN SHALL existir um card "Histórico de pedidos" descrevendo que cada pedido enviado fica registrado com itens e total.
2. WHEN o visitante lê o FAQ THEN SHALL existir uma pergunta explicando que o pedido é registrado no painel mesmo indo para o WhatsApp, e que não há checkout/pagamento no site.
3. WHEN o visitante compara os planos THEN "Histórico de pedidos" SHALL constar em Starter e Pro e SHALL NOT constar no Free.
4. WHEN um agente/dev lê a documentação THEN `docs/ARCHITECTURE.md` (schema, arquivos, estado atual), `docs/roadmap/Escopo.md` (§4.2 e §5) e `AGENTS.md` (se necessário) SHALL refletir a existência de `orders`/`order_items` e da tela de pedidos.
5. WHEN o visitante lê `/politica-de-privacidade` THEN SHALL constar que os dados do pedido (itens, total e nome informado pelo cliente) são armazenados para o lojista.

**Independent Test**: abrir `/` e conferir card, FAQ e bullets de plano; abrir `/politica-de-privacidade` e achar a menção.

---

## Edge Cases

- WHEN a sacola está vazia THEN nenhum botão de envio SHALL ser exibido (comportamento atual preservado) e nada SHALL ser gravado.
- WHEN a loja não configurou WhatsApp THEN o checkout continua bloqueado e nenhum pedido SHALL ser gravado.
- WHEN o navegador bloqueia a aba pré-aberta (`window.open` retorna `null`) THEN o sistema SHALL navegar na aba atual (`window.location.href`) para o `wa.me`.
- WHEN o cliente está offline no momento do envio THEN o WhatsApp SHALL abrir (ou falhar por conta do próprio navegador) sem nenhum erro de gravação visível.
- WHEN o preço do produto mudou entre a adição à sacola e o envio THEN o pedido gravado SHALL usar o preço atual do banco, ainda que a mensagem do WhatsApp mostre o preço antigo.
- WHEN o nome do cliente tem mais de 60 caracteres THEN o valor SHALL ser truncado em 60 caracteres (sem rejeitar o pedido).
- WHEN o mesmo produto aparece na sacola com variações diferentes (tamanho/cor) THEN cada variação SHALL gerar uma linha própria em `order_items`.
- WHEN a loja é excluída THEN seus pedidos e itens SHALL ser excluídos em cascata.
- WHEN uma loja Free acumula pedidos e depois é liberada como Starter THEN o histórico anterior SHALL aparecer integralmente (nada é gravado de forma diferente por plano).
- WHEN a loja Free tenta chamar a Server Action de status direto THEN a RLS por dono SHALL continuar valendo — o gate de plano é de visualização, não substitui o isolamento por loja.
- WHEN dois clientes enviam pedidos simultaneamente THEN ambos SHALL ser gravados sem interferência (ids independentes; nenhuma sequência compartilhada).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| ORD-01 | P1: Pedido registrado (gravação + redirect sempre) | Design | ✅ Verified |
| ORD-02 | P1: Pedido registrado (preço do banco) | Design | ✅ Verified |
| ORD-03 | P1: Pedido registrado (timeout/falha silenciosa) | Design | ✅ Verified |
| ORD-04 | P1: Pedido registrado (idempotência) | Design | ✅ Verified |
| ORD-05 | P1: Pedido registrado (nova chave ao mudar sacola) | Design | ✅ Verified |
| ORD-06 | P1: Pedido registrado (itens não resolvidos) | Design | ✅ Verified |
| ORD-07 | P1: Pedido registrado (validação e limites do payload) | Design | ✅ Verified |
| ORD-08 | P1: Pedido registrado (teto anti-abuso) | Design | ✅ Verified |
| ORD-09 | P1: Nome opcional (campo na sacola) | Design | ✅ Verified |
| ORD-10 | P1: Nome opcional (trim + 60 chars / null) | Design | ✅ Verified |
| ORD-11 | P1: Nome opcional (nunca bloqueia checkout, template intacto) | Design | ✅ Verified |
| ORD-12 | P1: Histórico (lista da própria loja, ordenada) | Design | ✅ Verified |
| ORD-13 | P1: Histórico (paginação 20) | Design | ✅ Verified |
| ORD-14 | P1: Histórico (detalhe do pedido com itens snapshot) | Design | ✅ Verified |
| ORD-15 | P1: Histórico (estado vazio) | Design | ✅ Verified |
| ORD-16 | P1: Histórico (rota protegida + navegação Sidebar/MobileTabBar) | Design | ✅ Verified |
| ORD-17 | P1: ROI (card Pedidos no mês) | Design | ✅ Verified |
| ORD-18 | P1: ROI (card Vendas confirmadas no mês) | Design | ✅ Verified |
| ORD-19 | P1: ROI (card Aguardando confirmação) | Design | ✅ Verified |
| ORD-20 | P1: ROI (zeros seguros, sem NaN) | Design | ✅ Verified |
| ORD-21 | P2: Status (persistir e refletir) | Design | ✅ Verified |
| ORD-22 | P2: Status (qualquer transição entre os 3; valor inválido rejeitado) | Design | ✅ Verified |
| ORD-23 | P2: Status (isolamento por loja) | Design | ✅ Verified |
| ORD-24 | P1: Segurança (sem GRANT/policy para `anon`; RLS por dono; service role server-only) | Design | ✅ Verified |
| ORD-25 | P2: Landing (card de recurso + FAQ + planos) | T15 | ✅ Verified |
| ORD-26 | P2: Docs (ARCHITECTURE, Escopo) + política de privacidade | T16 | ✅ Verified |
| ORD-27 | P1: Planos pagos (captura grava em qualquer plano) | Design | ✅ Verified |
| ORD-28 | P1: Planos pagos (histórico bloqueado no Free, sem dado real e sem query) | Design | ✅ Verified |
| ORD-29 | P1: Planos pagos (cards de ROI bloqueados no Free) | Design | ✅ Verified |
| ORD-30 | P1: Planos pagos (Starter/Pro liberam tudo; expiração rebaixa via `getEffectivePlan`) | Design | ✅ Verified |
| ORD-31 | P1: Nome obrigatório (bloqueio no cliente + rejeição no servidor) | Ciclo 2 | ✅ Verified |
| ORD-32 | P1: Código do pedido gerado no cliente, na mensagem e em `orders.code` | Ciclo 2 | ✅ Verified |
| ORD-33 | P1: Formato padrão e "Restaurar padrão" com nome e código (as duas fontes idênticas) | Ciclo 2 | ✅ Verified |
| ORD-34 | P1: Variáveis `{nome}`/`{pedido}` disponíveis, com chips e preview; template customizado preservado | Ciclo 2 | ✅ Verified |
| ORD-35 | P1: Código na lista e no detalhe + busca por código ou nome | Ciclo 2 | ✅ Verified |

**ID format:** `ORD-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 35 total, **35 verificados** — ORD-01..30 na iteração 2 do ciclo 1 e ORD-31..35 no ciclo 2 (`validation.md`), 0 sem mapeamento ✅

---

## Success Criteria

- [ ] 100% dos envios de pedido com produtos válidos e loja ativa geram uma linha em `orders` no ambiente local de teste
- [ ] Nenhum caminho de erro da gravação impede o `wa.me` de abrir (verificado com banco derrubado e com timeout forçado)
- [ ] `orders`/`order_items` inacessíveis ao papel `anon` (SELECT e INSERT diretos na API do Supabase falham)
- [ ] Lojista Starter/Pro consegue responder "quantos pedidos e quanto vendi esse mês?" em menos de 5 segundos após abrir o painel
- [ ] Loja Free: pedido gravado no banco e zero dado do histórico no HTML da página de pedidos (verificado no fonte da resposta)
- [ ] Suíte de testes existente continua verde + novos testes cobrindo cada AC de P1/P2
