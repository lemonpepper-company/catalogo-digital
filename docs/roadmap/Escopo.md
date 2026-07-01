# Escopo do Produto — Catálogo Digital V1

**Versão:** 2.2  
**Data:** 30 de junho de 2026

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
| Landing page | Hero, dor, como funciona, features, depoimentos, planos, FAQ, CTA final | ✅ Implementado |
| Cadastro | Seção "Sua conta" + Seção "Sua loja" com preview do slug em tempo real | ✅ Implementado |
| Escolha de plano | Cards Starter R$49 e Pro R$99. Sem cartão. 14 dias grátis nos dois. | ✅ Implementado |
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

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Trial de 14 dias | Acesso Pro completo. Sem cartão no cadastro. Nos dois planos. | ✅ Lógica implementada (`trial_ends_at` no banco) |
| Tela de escolha de plano | Exibida após cadastro. Cobrança só no dia 15. | ✅ Implementado (UI + Server Action) |
| Banner de trial | No dashboard: dias restantes + CTA "Assinar agora". | ✅ Implementado |
| Loja oculta após expiração | Catálogo exibe página de expiração quando trial vence e sem plano ativo | ✅ Implementado |
| Integração de pagamento | Stripe ou Pagar.me — cobrança recorrente, conversão no dia 15 | ⏳ Pendente |
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

| | Starter | Pro |
|---|---|---|
| **Preço** | R$ 49/mês | R$ 99/mês |
| Produtos | Até 30 | Ilimitados |
| Categorias | Até 5 | Ilimitadas |
| Fotos por produto | Até 3 | Até 5 |
| GA + Pixel | Incluso | Incluso |
| Template de mensagem | Incluso | Incluso |
| Trial | 14 dias grátis (acesso Pro) | 14 dias grátis |

> O trial concede acesso Pro em ambos os planos. Quem cadastrar mais de 30 produtos durante o trial e escolher Starter no dia 15 precisará remover produtos até o limite.

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
| Catálogo em trial | Público e ativo durante 14 dias. Banner só no painel. |
| Catálogo após expiração | Exibe `CatalogExpired` (página de expiração). Dados preservados. |
| Limite do Starter | Ao atingir 30 produtos, botão desabilitado + mensagem de upgrade. |
| Listagem de produtos | Tela padrão ao clicar em "Produtos" no menu — não o formulário de criação. |
| WhatsApp sem código | Número normalizado com `+55` ao montar o link de checkout. |

---

## 10. Riscos e mitigações

| Risco | Descrição | Mitigação |
|---|---|---|
| Churn no mês 2 | Lojista cadastra e depois abandona | Notificação semanal com dados de acesso via GA. Banner de trial cria urgência. |
| Não conversão no trial | Experimenta mas não assina | E-mail de recuperação no dia 12. Catálogo oculto — não deletado — incentiva reativar. |
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
| 6 | Integração de pagamento | ⏳ Próximo — Stripe ou Pagar.me, cobrança recorrente, trial automático |
| 7 | Validação com lojistas | ⏳ Aguarda pagamento — 5 lojistas de moda locais em beta fechado |
| 8 | Launch | ⏳ Após validação e pagamento funcionando |
