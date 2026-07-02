# Painel do lojista — responsivo para mobile

**Data:** 2026-07-02
**Status:** Aprovado para planejamento

## Objetivo

O painel do lojista (`/painel`) hoje é desktop-first: sidebar fixa de 248px, tabela de produtos com colunas de largura fixa em pixels, grids de duas/três colunas e padding lateral generoso. Nada disso é utilizável numa tela de smartphone. O objetivo desta rodada é dar paridade total entre desktop e mobile — o lojista consegue fazer qualquer operação (ver dashboard, cadastrar/editar produto com fotos, gerenciar categorias, ajustar configurações da loja) direto pelo celular.

## Escopo

**Dentro:**
- Layout responsivo das 5 telas do painel: Dashboard, Produtos (lista), Novo/Editar produto, Categorias, Configurações.
- Navegação mobile (bottom tab bar) substituindo a sidebar fixa abaixo do breakpoint `lg:`.
- Realocação de "Sair" e do link do catálogo público para a página Configurações.
- Ajustes de grid/padding/tipografia nos componentes compartilhados usados no painel (`Card`, `Modal`, `StatCard`) quando necessário para caber em 375px.

**Fora desta rodada:**
- Catálogo público (`/[slug]`) — já é mobile-first, não muda.
- Páginas de autenticação (`/login`, `/cadastro`, etc.) — fora do escopo pedido.
- Qualquer funcionalidade nova (esta rodada é só responsividade de UI já existente).
- App nativo / PWA — fora de escopo, é responsividade web via navegador mobile.

## Estratégia

Mobile-first com Tailwind CSS, seguindo a convenção já formalizada em `docs/CONVENTIONS.md` ("estilize para mobile primeiro; use breakpoints para adaptar ao desktop") e já praticada no catálogo público (`app/[slug]/`). Sem detecção de viewport via JS (`useState`/`matchMedia`) — toda a adaptação é resolvida com classes responsivas do Tailwind, evitando hydration mismatch e lógica extra nos componentes (viola a convenção "sem lógica nos templates" se fosse via JS).

**Breakpoint de troca: `lg:` (1024px).** Abaixo desse valor (celular e tablet em retrato) usa-se o layout mobile; a partir dele, o layout desktop atual permanece inalterado. Justificativa: a sidebar de 248px + conteúdo fica apertada mesmo em tablets, então o corte em `lg` (em vez de `md`/768px) garante espaço confortável para o layout desktop sem regressão em telas intermediárias.

Nenhuma dependência nova é necessária.

## 1. Navegação (`app/painel/layout.tsx` + `components/painel/Sidebar.tsx`)

- **`lg:` e acima:** sidebar lateral atual, sem alterações visuais.
- **Abaixo de `lg:`:** a sidebar não é renderizada; em seu lugar, uma **bottom tab bar fixa** (`fixed bottom-0 inset-x-0`) com os mesmos 4 itens de navegação (Dashboard, Produtos, Categorias, Configurações) — ícone Lucide + label curto, item ativo destacado com o mesmo tratamento visual (`bg-linen text-obsidian`) usado hoje no item ativo da sidebar.
- `<main>` ganha padding-bottom extra no mobile (`pb-20` ou equivalente à altura da tab bar) para o conteúdo não ficar coberto.
- O banner de trial (`showTrialBanner`) usa `whitespace-nowrap` hoje, o que vaza da viewport em mobile — passa a permitir quebra de linha (`flex-wrap`, sem `whitespace-nowrap`) abaixo de `lg:`, mantendo layout de linha única acima disso.
- Padding do container de conteúdo (`px-12 py-10` em `layout.tsx`) é reduzido no mobile (`px-4 py-6`) e cresce nos breakpoints intermediários até o valor atual em `lg:`.
- **"Sair" e o card "Catálogo público em"** saem da sidebar/tab-bar (não há espaço na tab bar para eles, e duplicariam navegação) e passam a viver na página **Configurações**, num Card fixo no topo — visível em todos os breakpoints (não só mobile), para manter a UI consistente entre tamanhos de tela e não introduzir dois comportamentos divergentes.

## 2. Dashboard (`DashboardClient.tsx`, `use-dashboard.ts` inalterado)

- `grid grid-cols-3 gap-4` dos `StatCard` vira `grid-cols-1 gap-3` no mobile, com breakpoint intermediário (`sm:grid-cols-3`) já a partir de telas maiores que smartphone.
- Card "Link do catálogo" (linha ~58-87): o `flex items-center justify-between` com botões "Abrir"/"Copiar link" ao lado empilha em `flex-col items-stretch` no mobile.
- Lista "Produtos recentes": já é composta por linhas simples com `truncate` e ícone/badge à direita — funciona sem mudança estrutural, apenas revisão de padding horizontal.

## 3. Produtos — lista (`ProdutosClient.tsx`, `use-produtos.ts` inalterado)

- A "tabela" atual (linha de cabeçalho + linhas com colunas de largura fixa em px: `w-[120px]` estoque, `w-[140px]` visibilidade, `w-[76px]` ações) não cabe em 375px. Abaixo de `lg:`, cada produto vira um **card empilhado**:
  - Linha 1: foto + nome + preço (como hoje).
  - Linha 2: estoque (texto) + switch de ativo/inativo lado a lado.
  - Ícones de editar/excluir no canto superior direito do card.
  - Cabeçalho de colunas ("Produto", "Estoque", "Visibilidade") não é renderizado no mobile — os cards já são autoexplicativos.
- Acima de `lg:`, layout de linha atual mantido sem alteração.
- Resumo de contadores (ativos/esgotados/inativos, `flex items-center gap-10 flex-wrap`) empilha em `flex-col gap-3` no mobile para não espremer os números.

## 4. Novo/Editar produto (`ProdutoFormClient.tsx`, `use-produto-form.ts` inalterado)

- Grid de fotos `grid-cols-5 gap-3` vira `grid-cols-3 gap-2.5` no mobile (thumbnails maiores, mais fáceis de tocar) → volta a `sm:grid-cols-5` a partir do breakpoint intermediário.
- Os dois `grid-cols-2` de campos de formulário (seção "Informações" e seção de variações/cores) empilham em coluna única (`grid-cols-1`) abaixo de `lg:`.
- Upload de foto (`<input type="file" accept="image/*" multiple>`) já aciona a câmera/galeria nativamente em navegadores mobile — nenhuma mudança necessária.
- Botões de ação no rodapé do formulário (`flex items-center gap-3`) permanecem em linha (cabem bem mesmo em mobile), sem alteração.

## 5. Categorias (`CategoriasClient.tsx`, `use-categorias.ts` inalterado) e Configurações (`ConfiguracoesClient.tsx`, `use-configuracoes.ts` inalterado)

- Mesma lógica dos itens acima: qualquer `grid-cols-2` ou `flex` horizontal com múltiplos elementos lado a lado (ex.: avatar da loja + botão de upload, campos de nome/slug) empilha em coluna única abaixo de `lg:`.
- Novo Card "Conta" no topo de Configurações (ver seção 1) com link do catálogo público e botão "Sair".

## 6. Componentes compartilhados (`components/ui/`)

- **Modal** (`Modal.tsx`): já usa `w-full max-w-md` no wrapper, funcionando razoavelmente em mobile por herança. Ajuste pontual: `p-6` interno reduz para `p-5` abaixo de `lg:` para dar mais respiro em telas estreitas.
- **StatCard**, **Card**, **Switch**: revisão de padding interno caso algum valor fixo em px cause overflow em 375px; sem mudança estrutural esperada.

## Testes / Verificação

Mudança é puramente de layout (classes Tailwind responsivas), sem lógica nova — não há caso de teste unitário (Vitest) a acrescentar. Verificação é visual, via dev server, cobrindo:

- As 5 telas do painel em viewport mobile (375px) e desktop (≥1280px).
- Bottom tab bar aparece só abaixo de `lg:` e navega corretamente entre as 4 seções.
- Nenhum scroll horizontal indesejado em nenhuma tela testada em 375px.
- Formulário de produto: upload de foto, preenchimento de campos e submit funcionam em viewport mobile.
- Layout desktop (`lg:` e acima) permanece pixel-idêntico ao atual — sem regressão.
