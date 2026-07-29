# Escopo do Produto — Catálogo Digital V1

**Versão:** 2.5  
**Data:** 28 de julho de 2026

> **Modelo de planos:** Free (automático no cadastro), Starter e Pro (liberados manualmente após contato via WhatsApp — "Fale conosco" na landing —, sem gateway de pagamento integrado ainda). A seção de depoimentos (fictícios) segue oculta na landing. Ver §4.3 e §6.

---

## 1. Visão geral

SaaS de assinatura para lojistas de varejo — foco inicial em moda — que permite criar um catálogo online personalizado e converter visitantes em compradores via WhatsApp. O cliente final monta uma sacola com múltiplos produtos e envia o pedido completo via WhatsApp com mensagem pré-formatada e customizável.

**Posicionamento:** vitrine digital premium. O lojista deve sentir que está à frente da concorrência.

---

## 2. Perfis de usuário

| Perfil | Descrição | Principal necessidade |
|---|---|---|
| Lojista (B2B) | Dono de loja de moda, boutique, revendedora. Paga a mensalidade. | Montar catálogo rápido e receber pedidos organizados sem esforço |
| Cliente final | Comprador que acessa o catálogo via link compartilhado. | Montar sacola, ver total e enviar pedido com um clique |

---

## 3. Telas do produto

### 3.1 Fluxo de autenticação

| Tela | Elementos principais | Status |
|---|---|---|
| Landing page | Hero, dor, como funciona, features, planos (Free, Starter, Pro — CTA "Fale conosco" para os pagos), FAQ, CTA final. Seção de depoimentos oculta (fictícios, sem clientes reais ainda) | ✅ Implementado |
| Cadastro | Seção "Sua conta" + Seção "Sua loja" com preview do slug em tempo real. Loja nasce direto no plano Free, sem etapa de escolha de plano | ✅ Implementado |
| Login | E-mail + senha + Google OAuth + link esqueci senha + link cadastro em Gold Dust | ✅ Implementado |
| Verificar e-mail | Aguarda confirmação; botão de reenvio com email via query param | ✅ Implementado |
| Recuperar senha | Solicita email para reset | ✅ Implementado |
| Redefinir senha | Nova senha (requer token do email) | ✅ Implementado |

### 3.2 Painel do lojista

| Tela | Elementos principais | Status |
|---|---|---|
| Dashboard | Resumo (ativos, esgotados, link do catálogo) + cards de ROI (pedidos no mês, vendas confirmadas no mês, aguardando confirmação — bloqueados no Free). Aviso de upgrade no topo do painel para lojas no plano Free. Dados reais do banco. | ✅ Implementado |
| Listagem de produtos | Grid com status, toggle ativo/inativo, editar, excluir. Estado vazio. Dados reais. | ✅ Implementado |
| Pedidos (`/painel/pedidos`) | Histórico paginado (20/página) com data, nome do cliente, itens, total e status; detalhe em modal com itens, pagamento, entrega e troca de status. Estado vazio. Estado bloqueado no plano Free. | ✅ Implementado |
| Cadastro / edição de produto | Upload fotos (Storage), nome, preço, categoria (dropdown), cores (swatches + custom), tamanhos, estoque, visibilidade. | ✅ Implementado |
| Categorias | Lista com editar/excluir + formulário inline "Nova categoria". Dados reais. Limites de plano. | ✅ Implementado |
| Configurações da loja | Logo, nome, cor, WhatsApp, monograma, GA ID, Pixel ID, template de mensagem WhatsApp. | ✅ Implementado |

### 3.3 Catálogo público

| Tela | Elementos principais | Status |
|---|---|---|
| Home do catálogo | Header com logo/monograma + ícone da sacola com badge. Pills de categorias. Grid de produtos. Dados reais via RLS. | ✅ Implementado |
| Detalhe do produto | Foto grande, nome, preço, variações, quantidade, botão "Adicionar à sacola" sticky. | ✅ Implementado |
| Sacola (drawer) | Slide-in lateral com itens, quantidades, subtotais, total e CTA WhatsApp. | ✅ Implementado |
| Loja expirada / oculta | Página de expiração quando trial expirou e loja sem plano ativo. | ✅ Implementado |

---

## 4. Funcionalidades do V1

### 4.1 Gestão da loja

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Cadastro da loja | Nome, logo, cor principal, descrição, monograma | ✅ Implementado |
| Slug automático | Gerado do nome da loja. Preview em tempo real. Editável. Unicidade validada via API. | ✅ Implementado |
| Cadastro de produtos | Foto (Storage), nome, descrição, preço, variações, categorias | ✅ Implementado |
| Organização por categorias | Gestão de categorias separada. Dropdown no produto com criação inline. | ✅ Implementado |
| Controle de estoque básico | Quantidade + flag esgotado. Sem histórico de movimentações. | ✅ Implementado |
| Personalização do catálogo | Cor de destaque, logo, nome, monograma (fallback para logo) | ✅ Implementado |
| Seleção de cores no produto | Paleta de 16 cores preset (swatches) + input de cor customizada | ✅ Implementado |
| Google Analytics | Lojista cola o ID — script injetado no catálogo | ✅ Implementado |
| Pixel do Facebook | Lojista cola o Pixel ID — script injetado | ✅ Implementado |
| Upload de imagens | Supabase Storage (bucket product-images). Compressão no cliente. | ✅ Implementado |

### 4.2 Sacola e pedido

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Sacola de produtos | Cliente adiciona múltiplos produtos com variações e quantidades | ✅ Implementado |
| Drawer da sacola | Slide-in lateral com lista de itens, controles de quantidade e total | ✅ Implementado |
| Mensagem WhatsApp formatada | Lista numerada com produto, variação, qtd, subtotal por item, total em destaque | ✅ Implementado |
| Template customizável | Lojista edita o template da mensagem usando variáveis (`{saudacao}`, `{nome}`, `{pedido}`, `{itens}`, `{total}`, `{pagamento}`, `{entrega}`) | ✅ Implementado |
| Preview do template | Preview em tempo real com dados mockados na tela de configurações | ✅ Implementado |
| Variáveis disponíveis | Chips clicáveis para inserir variáveis no template | ✅ Implementado |
| Normalização do WhatsApp | Número normalizado com código do país (+55) no momento do checkout | ✅ Implementado |
| Nome do cliente na sacola | Campo **obrigatório** "Seu nome" (mín. 2 e máx. 60 caracteres após `trim()`): sem ele o envio fica bloqueado no cliente e o servidor rejeita o payload. O nome viaja na mensagem do WhatsApp | ✅ Implementado |
| Código do pedido na mensagem | Código de 6 caracteres `[A-Z0-9]` derivado do `client_order_id` **no cliente** (nunca depende da resposta do servidor), gravado em `orders.code` e presente na mensagem do WhatsApp | ✅ Implementado |
| Captura do pedido no banco | O pedido é gravado em `orders`/`order_items` antes do redirect: aba do WhatsApp pré-aberta no clique, timeout de 2500 ms e falha silenciosa (a venda nunca é bloqueada). Preço e total recalculados no servidor a partir de `products.price_cents`; idempotência por `client_order_id`. **Grava em qualquer plano, inclusive Free** | ✅ Implementado |
| Histórico de pedidos no painel | `/painel/pedidos` — lista paginada (20/página) com o código de cada pedido + detalhe com itens em snapshot (sobrevive à exclusão do produto), pagamento, entrega e total | ✅ Implementado |
| Busca no histórico | Campo único que filtra por código **ou** nome do cliente, no servidor (`?q=`), case-insensitive e dentro da loja, com a paginação recalculada sobre o resultado filtrado | ✅ Implementado |
| Status da venda | `pendente` (padrão da captura) / `confirmado` / `cancelado`, com qualquer transição permitida; só os confirmados somam no faturamento do painel | ✅ Implementado |
| Cards de ROI no dashboard | "Pedidos no mês" (não cancelados), "Vendas confirmadas no mês" (R$) e "Aguardando confirmação", com corte do mês no fuso `America/Sao_Paulo` | ✅ Implementado |

### 4.3 Planos e liberação de acesso

> Toda loja nasce automaticamente no plano Free (`plan = 'free'`), sem cobrança e sem prazo de expiração. Starter e Pro são liberados manualmente: o lojista entra em contato pelo WhatsApp ("Fale conosco" na landing), você avalia e atualiza `plan` e `trial_ends_at` direto na tabela `stores` do Supabase. Não há gateway de pagamento integrado nesta fase.

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Cadastro já com plano Free | `plan='free'`, `trial_ends_at=null` definidos na criação da loja (`/auth/callback` e `createStore`) | ✅ Implementado |
| Liberação manual de Starter/Pro | Edição direta de `plan` e `trial_ends_at` na tabela `stores` pelo Supabase, após contato via WhatsApp | ✅ Implementado |
| Rebaixamento automático ao expirar | Quando `trial_ends_at` de um Starter/Pro liberado manualmente passa, os limites efetivos caem para o Free — calculado a cada checagem (`getEffectivePlan()`), sem gravar nada no banco nem job agendado | ✅ Implementado |
| Aviso de upgrade no painel | Lojas no plano efetivo Free veem um aviso no topo do painel com link para o WhatsApp | ✅ Implementado |
| Histórico e ROI só a partir do Starter | Capability `hasOrderHistory` em `getPlanLimits()`: no plano efetivo Free, `/painel/pedidos` e os cards de ROI mostram o estado bloqueado (`RecursoBloqueado`) e o gate roda **antes da query**, sem nenhum dado real no HTML. A captura do pedido, ao contrário, grava em qualquer plano — ao subir para Starter o histórico já está cheio. Starter/Pro com `trial_ends_at` vencido caem no bloqueio automaticamente | ✅ Implementado |
| Tela de escolha de plano | Removida — Starter/Pro só existem na landing, com CTA "Fale conosco" | ❌ Removido |
| Loja oculta após expiração | Depende de `is_active`, não de `trial_ends_at` — segue funcionando para desativação manual | ✅ Implementado |
| Integração de pagamento | Stripe ou Pagar.me — cobrança recorrente automática | ⏳ Pendente — retomado após a validação |
| Webhook de pagamento | Processar upgrades, cancelamentos e expiração via webhook | ⏳ Pendente |
| Cancelamento | Sem fidelidade. Catálogo oculto até reativação. Dados preservados. | ⏳ Pendente (depende do pagamento) |

---

## 5. Fora do escopo do V1

| Funcionalidade | Motivo | Versão |
|---|---|---|
| Impressão / recibo de pedidos | O histórico já existe (§4.2); recibo imprimível é outro ciclo | V2 |
| Exportação CSV do histórico | Ficou para o ciclo seguinte — neste ciclo o usuário priorizou o status da venda | V2 |
| Notificação de novo pedido (e-mail/push) | Exige provedor de envio e configuração; não é necessário para provar o ROI | V2 |
| Múltiplos usuários por loja | Complexidade de permissões desnecessária no MVP | V2 |
| Domínio personalizado | DNS + SSL por tenant — infra adicional | V2 |
| Analytics próprio no painel | GA já cobre no V1 | V2 |
| Integração sacola do Instagram | API Meta exige aprovação — meses de burocracia | Fora |
| App mobile nativo | Web responsiva resolve | Fora |
| Checkout próprio | Vira marketplace — complexidade 10x | Fora |

---

## 6. Modelo de monetização

> O Free não tem preço — é a porta de entrada padrão do cadastro. Starter e Pro ainda não têm preço fixo publicado: a landing mostra "Sob consulta" e a liberação é negociada manualmente pelo WhatsApp enquanto não há gateway de pagamento integrado.
>
> **Histórico de pedidos:** o pedido é gravado em qualquer plano, inclusive no Free — o que os planos pagos liberam é a **visualização** (histórico, detalhe, status e números de faturamento). Quem sobe do Free para o Starter encontra o histórico do período gratuito já preenchido.

| | Free | Starter | Pro |
|---|---|---|---|
| **Preço** | Grátis | Sob consulta | Sob consulta |
| Produtos | Até 8 | Até 30 | Ilimitados |
| Categorias | 1 | Até 5 | Ilimitadas |
| Fotos por produto | 1 | Até 3 | Até 5 |
| Histórico de pedidos | — | Incluso | Incluso |
| Personalização (cor + capa) | Incluso | Incluso | Incluso |
| Mensagem de pedido customizada | Incluso | Incluso | Incluso |
| Formas de pagamento/entrega | Incluso | Incluso | Incluso |

**Liberação de Starter/Pro:** feita manualmente direto no Supabase (`plan` + `trial_ends_at`), depois de contato via WhatsApp pela landing. Quando `trial_ends_at` vence, a loja passa a valer os limites do Free automaticamente nas checagens — sem nenhum valor sendo regravado no banco.

---

## 7. Fluxo do slug — URL da loja

- Gerado automaticamente a partir do nome da loja no cadastro
- Transformação: lowercase → remoção de acentos → espaços viram hífens → remove especiais
- Exemplo: `"Boutique da Ana!"` → `boutique-da-ana`
- Preview em tempo real ao digitar o nome da loja
- Validação de unicidade via `GET /api/slug/check` — sugestão automática se slug existir (`boutique-da-ana-2`)
- Editável nas configurações com nova validação ao salvar
- Nome da pessoa é interno e **não aparece na URL**
- URL final: `/{slug}` na raiz do domínio (ex: `catalogo.digital/boutique-da-ana`)

---

## 8. Template padrão da mensagem WhatsApp

```
Olá! Gostaria de fazer um pedido:

01. Produto Exemplo
    Quantidade: 2x | Valor unitário: R$ 50,00
    Tamanho: M
    Cor: Preto
    Subtotal: R$ 100,00

02. Outro Produto
    Quantidade: 1x | Valor unitário: R$ 65,20
    Tamanho: G
    Cor: Branco
    Subtotal: R$ 65,20

━━━━━━━━━━━━━━━━━
*Total: R$ 165,20*
━━━━━━━━━━━━━━━━━
```

**Variáveis disponíveis:** `{saudacao}` · `{itens}` · `{total}`

---

## 9. Comportamentos críticos

| Comportamento | Regra |
|---|---|
| Sacola | Persiste durante a navegação no catálogo. Badge atualiza em tempo real. |
| Mensagem WhatsApp | Construída com todos os itens da sacola no template configurado. Nova aba pré-aberta no clique; se o navegador bloquear o pop-up, navega na aba atual. |
| Captura do pedido | Nunca bloqueia a venda: a gravação tem timeout de 2500 ms e qualquer falha fica só no log do servidor — o WhatsApp abre do mesmo jeito, sem erro para o cliente. Valores nunca vêm do cliente: preço e total são recalculados a partir de `products.price_cents`. |
| Produto esgotado | Oculto no catálogo público se `stock=0` OU `is_active=false` (RLS). No painel aparece com badge. |
| Catálogo em uso | Público e ativo enquanto `is_active=true`, independente do plano. Loja no plano efetivo Free tem os limites de criação mais restritos, mas o catálogo já publicado continua no ar normalmente. |
| Catálogo após expiração | Exibe `CatalogExpired` (página de expiração) quando `is_active=false`. Dados preservados. Não ocorre automaticamente — depende de desativação manual. |
| Limite de plano atingido | Ao atingir o limite de produtos/categorias do plano efetivo, botão desabilitado + mensagem indicando para falar com a Vtrine. |
| Listagem de produtos | Tela padrão ao clicar em "Produtos" no menu — não o formulário de criação. |
| WhatsApp sem código | Número normalizado com `+55` ao montar o link de checkout. |

---

## 10. Riscos e mitigações

| Risco | Descrição | Mitigação |
|---|---|---|
| Churn no mês 2 | Lojista cadastra e depois abandona | Notificação semanal com dados de acesso via GA. Aviso de upgrade no painel para quem está no Free. |
| Não conversão do Free para pago | Usa o Free e nunca fala com a gente | Aviso de upgrade no painel; acompanhamento manual dos lojistas mais ativos para oferecer Starter/Pro por WhatsApp. |
| Concorrência com Instagram | Lojistas já usam Instagram Shopping de graça | Pitch: catálogo vai pro WhatsApp (90% abertura vs 5–10% feed). Sacola de pedidos é diferencial. |
| Slug duplicado | Dois lojistas com nome de loja similar | Validação em tempo real + sugestão automática de variação. |

---

## 11. Roadmap de implementação

| # | Etapa | Status |
|---|---|---|
| 1 | Identidade visual | ✅ Concluído — Bold Minimal Premium, Obsidian + Gold Dust |
| 2 | Telas e design system | ✅ Concluído — todos os componentes e páginas definidos |
| 3 | Auth + Supabase (cadastro, login, OAuth, planos) | ✅ Concluído |
| 4 | Painel do lojista com dados reais | ✅ Concluído — produtos, categorias, configurações, upload de fotos |
| 5 | Catálogo público com dados reais | ✅ Concluído — rota `/[slug]`, sacola, checkout WhatsApp |
| 6 | Plano Free + volta dos planos pagos na landing (CTA "Fale conosco", liberação manual) | ✅ Concluído (jul/2026) |
| 7 | Validação com lojistas | ⏳ Em andamento — Free automático, Starter/Pro liberados manualmente |
| 8 | Integração de pagamento | ⏳ Depois da validação — Stripe ou Pagar.me, cobrança recorrente automática para Starter/Pro |
| 9 | Launch | ⏳ Após validação e pagamento funcionando |
