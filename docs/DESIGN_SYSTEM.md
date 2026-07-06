# Design System — Bold Minimal Premium

**Produto:** Catálogo Digital V1  
**Versão:** 1.0

---

## 1. Paleta de cores

| Token | Hex | Nome | Uso |
|---|---|---|---|
| `--color-primary` | `#0D0D0D` | Obsidian | Navbar, botão primário, textos de peso. **No catálogo público, é sobrescrita por página** com a cor de destaque (`accentColor`) configurada pela loja — ver §5.8 |
| `--color-accent` | `#C9A96E` | Gold Dust | Valor padrão de `accentColor` para lojas novas; CTA de compra, ênfase máxima — usar com parcimônia |
| `--color-bg` | `#F9F9F7` | Ivory | Background principal de todas as páginas |
| `--color-surface` | `#F0EDE8` | Linen | Cards, inputs, seções alternadas |
| `--color-text-1` | `#0D0D0D` | Obsidian | Títulos e textos de alto contraste |
| `--color-text-2` | `#3D3D3D` | Graphite | Corpo de texto, descrições, preços |
| `--color-border` | `#E2DFDA` | Sand | Bordas de cards e divisores |

### 1.1 Cores de status

| Status | Hex | Uso |
|---|---|---|
| Sucesso | `#1A9C6E` | Produto salvo, link copiado, ação confirmada |
| Esgotado | `#C47E00` | Badge de produto sem estoque |
| Erro | `#C0392B` | Validação de formulário, falha de upload |
| Inativo | `#B0ADA8` | Produto desativado, estado desabilitado |

---

## 2. Tipografia

| Fonte | Peso | Tamanho | Uso |
|---|---|---|---|
| Sora | 600 SemiBold | 28–40px | Nome da loja, H1, títulos de página |
| Sora | 500 Medium | 18–24px | Nome do produto, H2, botões |
| DM Sans | 400 Regular | 14–16px | Descrições, preços, corpo de texto |
| DM Sans | 500 Medium | 12–14px | Labels, badges, categorias uppercase |

### 2.1 Escala tipográfica

| Token | Mobile | Desktop | Elemento |
|---|---|---|---|
| `--text-xs` | 10px | 10px | Labels de categoria uppercase |
| `--text-sm` | 12px | 13px | Preço, meta, texto de apoio |
| `--text-base` | 14px | 15px | Corpo, descrições |
| `--text-md` | 16px | 17px | Nome do produto, input labels |
| `--text-lg` | 20px | 22px | H2, preço em detalhe do produto |
| `--text-xl` | 26px | 32px | Nome da loja no header, H1 |

---

## 3. Espaçamento

Sistema baseado em múltiplos de 8px. Nunca usar valores fora dessa escala.

| Token | Valor | Uso típico |
|---|---|---|
| `--space-1` | 4px | Gap mínimo entre ícone e label |
| `--space-2` | 8px | Gap entre elementos internos de card |
| `--space-3` | 12px | Padding interno de pills e badges |
| `--space-4` | 16px | Gap entre cards no grid, padding de inputs |
| `--space-6` | 24px | Padding interno de cards |
| `--space-8` | 32px | Padding de página mobile |
| `--space-12` | 48px | Padding de página desktop |

---

## 4. Bordas e radius

| Elemento | Border radius | Nota |
|---|---|---|
| Cards de produto | 16px | Borda 0.5px solid `#E2DFDA` |
| Botões | 8px | Nunca full-rounded nos botões principais |
| Pills de categoria | 999px | Full-rounded exclusivo para pills e tags |
| Inputs | 8px | Focus ring: 2px solid Obsidian, offset 2px |
| Imagem do produto | 10px (topo apenas) | Base reta dentro do card |
| Drawer da sacola | 16px (esquerda) | Slide-in da direita |

> Sem `box-shadow` em nenhum componente. Elevação por contraste de cor de superfície.

---

## 5. Componentes

### 5.1 Botões

| Variante | Fundo | Texto | Uso |
|---|---|---|---|
| Primary | `#0D0D0D` | Branco | Ação principal do painel (salvar, publicar) |
| CTA Compra | `var(--color-primary)` (cor de destaque da loja, padrão `#C9A96E`) | Branco | "Adicionar à sacola", "Comprar" e "Enviar pedido via WhatsApp" — ver §5.8 |
| Ghost | Transparente | Obsidian | Ações secundárias (cancelar, restaurar padrão) |
| Destructive | `#FDECEA` | `#C0392B` | Excluir produto, ação irreversível |

### 5.2 Sacola

- Ícone no header do catálogo com badge numérico (fundo Obsidian, texto branco)
- Drawer slide-in da direita, largura 380px desktop / 100% mobile
- Overlay escuro 40% no fundo ao abrir
- Cada item: thumbnail 64px, nome, variações, seletor qtd (+/-), subtotal, botão remover
- Rodapé fixo: total em Sora 600 + CTA Gold Dust

### 5.3 Paleta de cores do produto

- 16 swatches circulares (40px) com as cores preset
- Selecionado: borda 2px Gold Dust + check icon
- Input de texto abaixo para cor customizada
- Chips removíveis acima da paleta para cores selecionadas

### 5.4 Toast de feedback

- Posição: bottom-center mobile, bottom-right desktop
- Duração: 3 segundos com fade out
- Sucesso: fundo Obsidian, texto branco, ícone check Gold Dust
- Sem X de fechar — desaparece automaticamente

### 5.5 Drawer / Modal

- Overlay: `rgba(0,0,0,0.4)`
- Sem `box-shadow` — borda sutil `0.5px solid #E2DFDA`
- Fechar: botão X no canto superior direito ou clique no overlay

### 5.6 Linha de contato do header

- Aparece abaixo do nome da loja no catálogo público, só quando há descrição, WhatsApp ou Instagram cadastrados
- Descrição: DM Sans 13px, cor Graphite
- Links: ícone Lucide (`MessageCircle` para WhatsApp, `Instagram` para Instagram) + label, 12px, cor Graphite, hover Obsidian
- Link de WhatsApp do header abre conversa vazia (sem mensagem) — diferente do CTA de checkout da sacola, que já leva o pedido

### 5.7 Seletor de pagamento/entrega (sacola)

- Mesmo estilo de chip usado na seleção de tamanho em `ProductDetail`: pílula com borda Sand, texto Obsidian; selecionado vira fundo Obsidian + texto branco
- Nenhuma opção vem pré-selecionada, mesmo havendo uma única opção configurada — padroniza com tamanho/cor
- Grupo (pagamento ou entrega) só aparece se a loja tiver ao menos 1 opção habilitada em Configurações
- Campo de endereço (input de texto livre) aparece só quando "Enviar no endereço" está selecionado

### 5.8 Cor de destaque (por loja)

- A loja escolhe uma cor em Configurações/Cadastro (paleta `ACCENT_COLOR_OPTIONS`, padrão Gold Dust `#C9A96E`), persistida em `stores.accent_color`
- No catálogo público (`app/[slug]/CatalogoClient.tsx`), essa cor é injetada como a variável CSS `--color-primary` num `style` na raiz da página — não é uma classe Tailwind fixa
- Componentes que usam `var(--color-primary)` diretamente no `style` (não a classe `bg-gold`) refletem essa cor automaticamente: monograma do header, botão de busca ativo (`StoreHeader`), botão "Adicionar à sacola" (`ProductCard`, `ProductDetail`) e "Enviar pedido via WhatsApp" (`BagDrawer`)
- No painel do lojista (`/painel`), `--color-primary` permanece fixo em Obsidian — a cor de destaque só tema o catálogo público, não o painel administrativo

---

## 6. Grid e breakpoints

| Breakpoint | Largura | Grid produtos | Padding lateral |
|---|---|---|---|
| Mobile (padrão) | 375px+ | 2 colunas | 16px |
| Tablet | 768px+ | 3 colunas | 32px |
| Desktop | 1280px+ | 4 colunas | 48px (max-width 1200px centrado) |

---

## 7. Tokens CSS — bloco para o `:root`

```css
:root {
  --color-primary: #0D0D0D;
  --color-accent: #C9A96E;
  --color-bg: #F9F9F7;
  --color-surface: #F0EDE8;
  --color-text-1: #0D0D0D;
  --color-text-2: #3D3D3D;
  --color-border: #E2DFDA;
  --font-display: 'Sora', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --radius-card: 16px;
  --radius-btn: 8px;
  --radius-pill: 999px;
  --space-2: 8px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
}
```

---

## 8. Paleta de cores preset para produtos

| Nome | Hex |
|---|---|
| Preto | `#0D0D0D` |
| Branco | `#F9F9F7` |
| Cinza | `#888888` |
| Bege | `#C9B99A` |
| Caramelo | `#C68642` |
| Vermelho | `#C0392B` |
| Rosa | `#E91E8C` |
| Roxo | `#7B5CF0` |
| Azul marinho | `#1A237E` |
| Azul claro | `#42A5F5` |
| Verde | `#2E7D32` |
| Laranja | `#E65100` |
| Amarelo | `#F9A825` |
| Dourado | `#C9A96E` |
| Prata | `#9E9E9E` |
| Bordô | `#880E4F` |
