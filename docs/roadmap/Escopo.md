# Escopo do Produto — Catálogo Digital V1

**Versão:** 2.3  
**Data:** 2 de julho de 2026

> **Modo demo:** a partir desta versão, o produto roda em modo demo para validação com lojistas. Preços, os CTAs "Começar" e a seção de depoimentos (fictícios) ficam ocultos na landing, o cadastro pula a escolha de plano e toda loja nova nasce direto no plano Starter com expiração indeterminada (sem cobrança). Ver §4.3 e §6 para o detalhe do que muda e o que volta quando a cobrança for reativada.

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
| Landing page | Hero, dor, como funciona, features, planos (sem preço, "Em breve", sem CTA), FAQ, CTA final. Seção de depoimentos oculta (fictícios, sem clientes reais ainda) | ✅ Implementado |
| Cadastro | Seção "Sua conta" + Seção "Sua loja" com preview do slug em tempo real | ✅ Implementado |
| Escolha de plano | Cards Starter R$49 e Pro R$99 (UI original, inalterada). Pulada no cadastro em modo demo — loja já nasce Starter e nunca chega nessa tela. | ⏸️ Fora do fluxo (modo demo) |
| Login | E-mail + senha + Google OAuth + link esqueci senha + link cadastro em Gold Dust | ✅ Implementado |
| Verificar e-mail | Aguarda confirmação; botão de reenvio com email via query param | ✅ Implementado |
| Recuperar senha | Solicita email para reset | ✅ Implementado |
| Redefinir senha | Nova senha (requer token do email) | ✅ Implementado |

### 3.2 Painel do lojista

| Tela | Elementos principais | Status |
|---|---|---|
| Dashboard | Resumo (ativos, esgotados, link do catálogo). Banner de trial durante 14 dias. Dados reais do banco. | ✅ Implementado |
| Listagem de produtos | Grid com status, toggle ativo/inativo, editar, excluir. Estado vazio. Dados reais. | ✅ Implementado |
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
| Template customizável | Lojista edita o template da mensagem usando variáveis (`{saudacao}`, `{itens}`, `{total}`) | ✅ Implementado |
| Preview do template | Preview em tempo real com dados mockados na tela de configurações | ✅ Implementado |
| Variáveis disponíveis | Chips clicáveis para inserir variáveis no template | ✅ Implementado |
| Normalização do WhatsApp | Número normalizado com código do país (+55) no momento do checkout | ✅ Implementado |

### 4.3 Trial e assinatura

> **Modo demo:** toda loja cadastrada nasce com `plan = 'starter'` e `trial_ends_at = null` (indeterminado). Não há trial de 14 dias nem cobrança — é acesso ao plano Starter (com os limites normais de 30 produtos/5 categorias/3 fotos), por tempo indeterminado, enquanto durar a validação com lojistas.

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Cadastro já com plano Starter | `plan='starter'`, `trial_ends_at=null` definidos na criação da loja (`/auth/callback` e `createStore`) | ✅ Implementado (modo demo) |
| Trial de 14 dias | Substituído pelo modo demo — lógica de `trial_ends_at` continua no banco (agora nullable) e é tratada como "sem expiração" quando nula | ⏸️ Suspenso (modo demo) |
| Tela de escolha de plano | Pulada no cadastro. Rota, Server Action `selectPlan` e UI (`PlanosContent.tsx`) seguem inalteradas no código — ficam apenas inacessíveis no fluxo até a cobrança voltar. | ⏸️ Fora do fluxo (modo demo) |
| Banner de trial | Não aparece para lojas em modo demo (`showTrialBanner = !store.plan`, e `plan` nunca é nulo) | ⏸️ Suspenso (modo demo) |
| Loja oculta após expiração | Depende de `is_active`, não de `trial_ends_at` — segue funcionando para desativação manual | ✅ Implementado |
| Integração de pagamento | Stripe ou Pagar.me — cobrança recorrente | ⏳ Pendente — retomado após a validação em modo demo |
| Webhook de pagamento | Processar upgrades, cancelamentos e expiração via webhook | ⏳ Pendente |
| Cancelamento | Sem fidelidade. Catálogo oculto até reativação. Dados preservados. | ⏳ Pendente (depende do pagamento) |

---

## 5. Fora do escopo do V1

| Funcionalidade | Motivo | Versão |
|---|---|---|
| Histórico de pedidos | Pedido vai pro WhatsApp — não é capturado no sistema | V2 |
| Status da venda | Depende do histórico de pedidos | V2 |
| Impressão de pedidos | Depende do histórico de pedidos | V2 |
| Múltiplos usuários por loja | Complexidade de permissões desnecessária no MVP | V2 |
| Domínio personalizado | DNS + SSL por tenant — infra adicional | V2 |
| Analytics próprio no painel | GA já cobre no V1 | V2 |
| Integração sacola do Instagram | API Meta exige aprovação — meses de burocracia | Fora |
| App mobile nativo | Web responsiva resolve | Fora |
| Checkout próprio | Vira marketplace — complexidade 10x | Fora |

---

## 6. Modelo de monetização

> **Em modo demo, preços não são exibidos e não há cobrança.** A tabela abaixo é o modelo planejado para quando a cobrança for reativada (pós-validação).

| | Starter | Pro |
|---|---|---|
| **Preço** | A definir | A definir |
| Produtos | Até 30 | Ilimitados |
| Categorias | Até 5 | Ilimitadas |
| Fotos por produto | Até 3 | Até 5 |
| GA + Pixel | Incluso | Incluso |
| Template de mensagem | Incluso | Incluso |

**Enquanto o modo demo estiver ativo:** todo cadastro recebe o plano Starter automaticamente, com expiração indeterminada (`trial_ends_at = null`) e sem cobrança no dia 15. Não há upgrade automático para Pro — quem quiser os limites Pro precisa aguardar a reativação da cobrança.

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
| Mensagem WhatsApp | Construída com todos os itens da sacola no template configurado. Sempre nova aba. |
| Produto esgotado | Oculto no catálogo público se `stock=0` OU `is_active=false` (RLS). No painel aparece com badge. |
| Catálogo em modo demo | Público e ativo por tempo indeterminado (`trial_ends_at=null`, `plan='starter'`). Sem banner de trial no painel. |
| Catálogo após expiração | Exibe `CatalogExpired` (página de expiração) quando `is_active=false`. Dados preservados. Não ocorre automaticamente em modo demo — depende de desativação manual. |
| Limite do Starter | Ao atingir 30 produtos, botão desabilitado + mensagem de upgrade. Se aplica normalmente em modo demo, já que toda loja nasce Starter. |
| Listagem de produtos | Tela padrão ao clicar em "Produtos" no menu — não o formulário de criação. |
| WhatsApp sem código | Número normalizado com `+55` ao montar o link de checkout. |

---

## 10. Riscos e mitigações

| Risco | Descrição | Mitigação |
|---|---|---|
| Churn no mês 2 | Lojista cadastra e depois abandona | Notificação semanal com dados de acesso via GA. (Banner de trial/urgência volta quando a cobrança for reativada — suspenso em modo demo.) |
| Não conversão no trial | Experimenta mas não assina | Não se aplica em modo demo (sem trial nem cobrança). Retomar e-mail de recuperação no dia 12 quando o modelo pago voltar. |
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
| 6 | Modo demo — preços/CTAs ocultos, cadastro direto no plano Starter, expiração indeterminada | ✅ Concluído (jul/2026) |
| 7 | Validação com lojistas | ⏳ Em andamento — beta em modo demo, sem cobrança |
| 8 | Integração de pagamento | ⏳ Depois da validação — Stripe ou Pagar.me, cobrança recorrente, reintroduzir `/escolha-de-plano` e preços |
| 9 | Launch | ⏳ Após validação e pagamento funcionando |
