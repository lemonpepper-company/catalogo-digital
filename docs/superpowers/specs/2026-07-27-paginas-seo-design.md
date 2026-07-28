# Páginas de conteúdo para SEO

**Data:** 2026-07-27
**Status:** Aprovado para planejamento de implementação

---

## 1. Contexto e objetivo

Investigação do Search Console mostrou que a home (`/`) está indexada corretamente e não há bug técnico de rastreamento — o problema é que o site tem, na prática, **uma única página indexável** (`app/sitemap.ts` só lista `/`, `/politica-de-privacidade`, `/termos-de-uso`, e as duas últimas o Google nem indexa por serem boilerplate). Isso limita a superfície de ranqueamento: não há texto suficiente pra o Google associar o site a variações de busca além do nome exato do domínio.

Objetivo: criar 5 páginas estáticas de nicho/caso de uso, cada uma otimizada pra uma keyword comercial relevante, ampliando a superfície indexável sem depender de um pipeline de blog (que exigiria produção de conteúdo recorrente pra valer a pena).

Fora de escopo: blog/MDX, backlinks, alteração de conteúdo da home, novo domínio/redirects.

---

## 2. Páginas e conteúdo

Todas seguem a mesma estrutura: Hero (H1 com a keyword) → Problema/Solução → Benefícios → FAQ → CTA final. Visual idêntico à home (mesmas cores, tipografia, navbar, footer, `WhatsAppFloatingButton`).

### 2.1 `/vitrine-digital`

- **Meta title:** "O que é Vitrine Digital? — Vtrine Digital"
- **Meta description:** "Vitrine digital é a loja online da sua marca, sem carrinho: o cliente vê os produtos e compra direto no WhatsApp. Veja como criar a sua grátis."
- **H1:** "O que é uma vitrine digital (e por que sua loja precisa de uma)"
- **Problema/Solução:** hoje o lojista mostra produto por print no WhatsApp ou Instagram — cliente não tem visão do catálogo completo, preço fica perdido na conversa, não passa profissionalismo. Vitrine digital é um link único, com todos os produtos organizados, que substitui isso.
- **Benefícios:** (1) Catálogo sempre atualizado, sem reenviar fotos; (2) Link único pra bio/status, funciona como "loja" mesmo sem site; (3) Cliente escolhe e o pedido já cai pronto no seu WhatsApp; (4) Visual com a cara da sua marca (cor, capa, nome).
- **FAQ:** "Vitrine digital é a mesma coisa que loja virtual?" (não — não tem carrinho nem checkout, a compra fecha no WhatsApp) · "Preciso saber programar?" (não, o catálogo é montado direto no painel) · "É pago?" (tem plano grátis pra começar).
- **CTA final:** "Criar minha vitrine grátis" → `/cadastro`.

### 2.2 `/catalogo-digital-gratis`

- **Meta title:** "Catálogo Digital Grátis — Crie o seu em minutos | Vtrine Digital"
- **Meta description:** "Crie um catálogo digital grátis pra mostrar seus produtos e vender pelo WhatsApp. Sem cartão de crédito, sem mensalidade pra começar."
- **H1:** "Criar catálogo digital grátis pra vender pelo WhatsApp"
- **Problema/Solução:** ferramentas de catálogo geralmente cobram antes de o lojista validar se funciona pra ele. Aqui dá pra montar o catálogo completo, publicar e vender no plano Free, sem cartão.
- **Benefícios:** (1) Sem cartão de crédito pra começar; (2) Catálogo completo com fotos, preços e categorias; (3) Upgrade só quando o negócio crescer (mais produtos, mais categorias); (4) No ar em poucos minutos.
- **FAQ:** "O grátis tem pegadinha, expira?" (não, o plano Free não expira) · "Quantos produtos cabem no grátis?" (referenciar o limite atual do plano Free, mesma fonte que a seção de preços da home) · "Dá pra migrar de plano depois?" (sim, a qualquer momento).
- **CTA final:** "Começar grátis agora" → `/cadastro`.

### 2.3 `/vender-pelo-whatsapp`

- **Meta title:** "Como Vender Pelo WhatsApp de Forma Organizada | Vtrine Digital"
- **Meta description:** "Aprenda a vender pelo WhatsApp sem perder pedido, sem cliente perguntando 'ainda tem?'. Catálogo online organizado, venda continua no seu WhatsApp."
- **H1:** "Vender pelo WhatsApp sem virar bagunça"
- **Problema/Solução:** (genérico, não fica restrito a roupa) vender só por conversa funciza até certo ponto: fotos somem no chat, tabela de preço desatualiza, cliente pergunta "ainda tem?" toda hora. Não importa o que você vende — acessório, cosmético, comida, artesanato — o catálogo organiza isso sem tirar a venda do WhatsApp.
- **Benefícios:** (1) Cliente navega o catálogo sozinho, sem te ocupar; (2) Preço e estoque sempre visíveis, sem "deixa eu confirmar"; (3) Pedido chega pronto, com item e valor, no seu WhatsApp; (4) Funciona pra qualquer tipo de produto, não só moda.
- **FAQ:** "Preciso ter site?" (não, o catálogo já é o link que você compartilha) · "Funciona pra qualquer tipo de produto?" (sim — moda, cosméticos, comida, artesanato, o que for) · "O cliente sai do WhatsApp pra comprar?" (não, a compra sempre fecha lá).
- **CTA final:** "Criar meu catálogo grátis" → `/cadastro`.

### 2.4 `/vitrine-online-sem-carrinho`

- **Meta title:** "Vitrine Online Sem Carrinho de Compras | Vtrine Digital"
- **Meta description:** "Loja virtual sem carrinho, sem checkout, sem taxa por venda. O cliente escolhe o produto e finaliza a compra direto com você, pelo WhatsApp."
- **H1:** "Uma vitrine online sem carrinho — porque a conversa é o checkout"
- **Problema/Solução:** loja virtual tradicional exige carrinho, gateway de pagamento, taxa por transação e configuração complexa. Pra quem vende no relacionamento (WhatsApp), isso é fricção desnecessária — o cliente já quer falar com você antes de comprar.
- **Benefícios:** (1) Sem taxa por venda, sem maquininha, sem gateway; (2) Sem carrinho abandonado — o pedido nasce como conversa; (3) Você negocia, combina entrega e forma de pagamento direto; (4) Configuração muito mais simples que uma loja virtual completa.
- **FAQ:** "Como o cliente paga então?" (combinado direto com você, pelo WhatsApp — Pix, cartão na entrega, o que preferir) · "Isso serve pra qualquer nicho?" (sim, qualquer loja que já venda ou queira vender por relacionamento) · "É mais simples que montar uma loja virtual?" (sim, não tem configuração de pagamento nem frete).
- **CTA final:** "Ver como funciona" → `/cadastro`.

### 2.5 `/alternativa-linktree-para-vender`

- **Meta title:** "Alternativa ao Linktree Pra Vender Produtos | Vtrine Digital"
- **Meta description:** "Link na bio genérico não vende. Troque por uma vitrine com produtos, preços e fotos — o cliente compra direto pelo WhatsApp, sem sair do link."
- **H1:** "Seu link na bio pode vender — não só listar links"
- **Problema/Solução:** Linktree e ferramentas parecidas são ótimas pra agrupar links, mas não foram feitas pra vender: não mostram produto, preço nem foto. Quem clica não sabe o que você vende até abrir outro app.
- **Benefícios:** (1) Um único link que já mostra o catálogo completo; (2) Cliente vê produto, preço e foto sem sair da vitrine; (3) Botão "Comprar" leva direto pro seu WhatsApp com o pedido; (4) Mesmo link que você já usa na bio do Instagram, só que agora vende.
- **FAQ:** "Preciso trocar meu link na bio?" (sim, é só substituir pelo link da sua vitrine) · "Dá pra usar junto com outros links (Linktree etc.)?" (sim, pode incluir a vitrine como um dos links) · "Funciona no celular?" (sim, é o formato principal de uso).
- **CTA final:** "Criar minha vitrine grátis" → `/cadastro`.

---

## 3. Arquitetura

### 3.1 Template compartilhado

`components/seo/SeoLandingPage.tsx` — Server Component que recebe um objeto de conteúdo tipado (hero, problemSolution, benefits, faq, cta) e renderiza a estrutura visual descrita acima, reaproveitando os padrões visuais já usados em `app/page.tsx` (cores/tokens do `docs/DESIGN_SYSTEM.md`, navbar, footer, `WhatsAppFloatingButton`).

Cada rota fica:

```
app/vitrine-digital/
  page.tsx     // generateMetadata + <SeoLandingPage content={content} />
  data.ts      // export const content: SeoLandingContent = { ... }
```

Repetido para as 5 rotas. `page.tsx` não tem lógica (consistente com `docs/CONVENTIONS.md` — páginas só compõem).

### 3.2 Tipo de conteúdo

```ts
// components/seo/types.ts
export interface SeoLandingContent {
  h1: string
  heroSubtitle: string
  problemSolution: { title: string; body: string }
  benefits: { title: string; desc: string }[]
  faq: { q: string; a: string }[]
  ctaLabel: string
  relatedLinks: { label: string; href: string }[] // 1-2 links pras outras páginas do grupo
}
```

### 3.3 Sitemap

As 5 URLs entram em `app/sitemap.ts`, mesmo padrão das existentes (`changeFrequency: "monthly"`, `priority: 0.6`).

---

## 4. Correção lateral: slugs reservados

Hoje não existe nenhuma validação que impeça um lojista de escolher, como slug da própria loja, um valor igual a uma rota estática do site (`storeSchema` em `app/actions/auth.ts:47` só valida formato via regex, não unicidade contra rotas). Como rota estática sempre tem prioridade sobre `app/[slug]/page.tsx`, uma loja criada com slug igual a uma dessas rotas fica inacessível.

Esse risco já existia (`login`, `painel`, `cadastro` etc.) e cresce com as 5 rotas novas. Correção:

```ts
// lib/reserved-slugs.ts
export const RESERVED_SLUGS = new Set([
  'login', 'cadastro', 'painel', 'api', 'auth', 'landing',
  'termos-de-uso', 'politica-de-privacidade',
  'recuperar-senha', 'redefinir-senha', 'verificar-email',
  'vitrine-digital', 'catalogo-digital-gratis', 'vender-pelo-whatsapp',
  'vitrine-online-sem-carrinho', 'alternativa-linktree-para-vender',
])
```

`storeSchema.slug` (criação de loja, `app/actions/auth.ts`) ganha um `.refine()` rejeitando valores em `RESERVED_SLUGS`, com mensagem "Esse link não está disponível." Não mexe em lojas já existentes — só bloqueia criação de novas.

---

## 5. Critérios de aceite

- As 5 rotas renderizam com conteúdo único (title/description/H1 diferentes), visual consistente com a home.
- `app/sitemap.ts` lista as 5 novas URLs.
- Criar loja com slug em `RESERVED_SLUGS` retorna erro amigável, sem tocar no banco.
- Nenhuma mudança na home, no `robots.ts` ou nas rotas existentes.
