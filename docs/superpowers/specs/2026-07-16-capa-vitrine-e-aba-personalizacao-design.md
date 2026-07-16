# Capa da vitrine + aba de Personalização

**Data:** 2026-07-16
**Status:** Aprovado para planejamento

---

## 1. Contexto e objetivo

Um lojista pediu a possibilidade de exibir uma imagem de **capa** na página de listagem de produtos do catálogo público — para anunciar um desconto ou uma propaganda da loja. Precisamos de um campo para o lojista subir essa imagem.

Aproveitando a mudança, a área de **personalização** da loja passa a ficar numa aba própria do painel, ao lado de Configurações. Inicialmente movemos para lá a **cor do botão de ação** (cor de destaque) e o novo **upload da capa**.

### Terminologia

- **Interface (pt-BR):** "Capa" / "Capa da vitrine"
- **Código (inglês, consistente com `accentColor`, `logoUrl`, `messageTemplate`):** `coverUrl` / `cover_url`

---

## 2. Decisões de produto

| Decisão | Escolha |
|---|---|
| Comportamento da capa | Apenas imagem exibida — **não clicável**, sem link |
| Posição na vitrine | **Entre o nome da loja e os filtros** de categoria |
| Rolagem | **Cabeçalho + filtros continuam fixos** no topo; a capa rola para fora ao descer |
| Proporção da imagem | **Proporção fixa 3:1, largura total, recortada** (`object-cover`); recomendação de ~1200×400px no upload |
| Gate de plano | **Sem gate** — disponível para todas as lojas, igual à cor de destaque |
| Remoção | O lojista pode **remover** a capa (é promocional/temporária) |
| Cor no onboarding | **Removida da etapa 2 do cadastro.** A loja nasce com o padrão Gold Dust (`#C9A96E`) e define a cor depois, na aba Personalização |
| Capa no onboarding | **Fora do cadastro** — só na aba Personalização |

---

## 3. Arquitetura

Aba e Server Action **independentes** (não reaproveitar `updateStoreSettings`), seguindo o padrão do projeto de "uma action por concern, um hook por feature". Cada aba tem formulário e salvamento isolados — salvar a personalização não re-valida nem re-grava os campos da Configuração.

**Refactor do `useLojaFields`:** hoje o hook compartilhado (`components/loja/use-loja-fields.ts`, usado por cadastro **e** Configurações) carrega `accent`/`setAccent`. Como a cor de destaque deixa de existir nessas duas telas (sai do cadastro e da Configurações), a `accent` **sai do `useLojaFields`** e passa a viver apenas no novo `use-personalizacao.ts`. O `useLojaFields` fica focado no que cadastro e Configurações realmente compartilham: identidade, WhatsApp, monograma, Instagram, descrição, logo e pagamento/entrega.

---

## 4. Modelo de dados

Nova coluna nullable em `stores`:

```sql
-- supabase/migrations/20260716000000_store_cover.sql
alter table stores add column cover_url text;
```

- **Sem mudança de RLS.** O upload usa o bucket existente `product-images` no path `{store_id}/cover/{uuid}.{ext}`. A policy de storage já permite o dono escrever em `store_id/` (mesmo mecanismo do logo, que usa `{store_id}/logo/...`).
- **Sem default.** Loja sem capa tem `cover_url = null`.

### Threading do campo pelos tipos

| Arquivo | Mudança |
|---|---|
| `lib/types.ts` | `Store` (público) e `StoreSettings` (painel) ganham `coverUrl: string \| null` |
| `lib/catalog.ts` | `PublicStoreRow` ganha `cover_url`; `resolveCatalog` mapeia para `coverUrl` |
| `lib/server/store.ts` | `StoreRow` ganha `cover_url`; `mapStore` mapeia para `coverUrl`; colunas SELECT de `getCurrentStore` incluem `cover_url` |
| `lib/server/catalog.ts` | `STORE_COLS` inclui `cover_url` |

---

## 5. Nova aba "Personalização"

Nova rota `app/painel/personalizacao/`:

| Arquivo | Responsabilidade |
|---|---|
| `page.tsx` | Server Component. Busca a loja via `getCurrentStore()` e passa props. Sem lógica (convenção de páginas). |
| `PersonalizacaoClient.tsx` | Dois Cards: **Cor de destaque** (reusa `CorDestaqueFields`) e **Capa da vitrine** (novo componente de upload). Botões Cancelar / Salvar + Toast. |
| `use-personalizacao.ts` | Hook com `useActionState` + estado do accent e da capa (File + preview + flag de remoção). |
| `loading.tsx` | Skeleton no padrão das outras rotas do painel. |

### Componente de upload da capa

Novo componente client (ex: `components/loja/CapaFields.tsx`) — segue o padrão de `IdentidadeFields` para o logo:

- Preview da capa atual (ou placeholder quando não há capa)
- Botão "Enviar capa" (`<input type="file" accept="image/*">`)
- Botão "Remover capa" quando há capa definida
- Texto de orientação: proporção recomendada ~1200×400px (3:1)
- Compressão no cliente antes do upload via `lib/image-compress.ts` (mesmo fluxo do logo em `use-loja-fields.ts`)

### Navegação

Novo item **"Personalização"** (ícone `Palette` do Lucide, outline ~2px) entre "Categorias" e "Configurações":

- `components/painel/Sidebar.tsx` (desktop) — novo `NavItem` para `/painel/personalizacao`
- `components/painel/MobileTabBar.tsx` (mobile) — novo `TabItem`; a barra passa de 4 para 5 itens

### O que sai da Configurações

- O Card "Cor de destaque" é **removido** de `app/painel/configuracoes/ConfiguracoesClient.tsx`.
- `use-configuracoes.ts` deixa de passar/enviar `accent` (não faz mais `formData.set("accentColor", ...)`), acompanhando o refactor do `useLojaFields`.
- Configurações mantém: **Identidade**, **Mensagem do pedido**, **Pagamento e entrega**.

---

## 5.1 Mudanças no onboarding (etapa 2 do cadastro)

O cadastro em duas etapas tem a etapa 2 (`/cadastro?step=loja`) num fluxo próprio (`app/(auth)/cadastro/`), **separado** da Configurações, que hoje também coleta a cor de destaque. Com a Opção B, a cor sai do onboarding:

- `CadastroForm.tsx` — remove a seção "Cor de destaque" (título + `CorDestaqueFields`) e o respectivo import. A etapa 2 passa a coletar: Nome/Link da loja, **Identidade**, **Pagamento e entrega**.
- `use-cadastro-form.ts` — deixa de fazer `formData.set("accentColor", loja.accent)` (o campo não é mais enviado). Acompanha a remoção de `accent` do `useLojaFields`.
- `app/actions/auth.ts` (`createStore`) — `accentColor` sai do `storeSchema` e do `safeParse`; o insert em `stores` passa a gravar o padrão fixo `accent_color: "#C9A96E"` (Gold Dust). A loja nasce com a cor padrão e o lojista ajusta depois na aba Personalização.

Nenhuma mudança de banco necessária para isso — `accent_color` já existe e já tem uso; apenas a origem do valor muda (form → default no servidor).

---

## 6. Server Action, validação e upload

Nova action `updatePersonalizacao(prev, formData): Promise<StoreActionState>` em `app/actions/store.ts`.

Fluxo (padrão de Server Action do projeto):

1. Valida sessão com `supabase.auth.getUser()`; retorna `{ error }` se não autenticado.
2. Busca a loja com `getCurrentStore()`; retorna `{ error }` se não encontrada.
3. Valida com novo schema `personalizacaoSchema` em `lib/validation/painel.ts`:
   ```ts
   export const personalizacaoSchema = z.object({
     accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
   });
   ```
   A `accentColor` **sai** de `storeSettingsSchema`.
4. Resolve a capa (`cover_url`):
   - Se `formData.get("removeCover")` estiver marcado → grava `cover_url = null`.
   - Senão, se há arquivo novo (`File` com `size > 0`) → `uploadToBucket(supabase, `${store.id}/cover/${crypto.randomUUID()}.${ext}`, file)`; grava a URL pública. `uploadToBucket` já valida tipo real por magic bytes e limite de 5MB.
   - Senão → preserva `store.coverUrl`.
5. `update` em `stores`: `{ accent_color, cover_url }`.
6. Revalidação: `revalidatePath("/painel/personalizacao")`, `revalidatePath("/painel")` e `revalidateTag(`catalog-${store.slug}`, { expire: 0 })` — a capa e a cor afetam a vitrine pública.

`updateStoreSettings` deixa de ler e gravar `accentColor` (migra para a nova action). O restante de `updateStoreSettings` é inalterado.

---

## 7. Renderização na vitrine pública

### Componente `components/catalogo/StoreBanner.tsx`

(Nome interno "Banner"; renderiza a capa.)

- Só renderiza quando `store.coverUrl` existe.
- Container largura total, **proporção fixa 3:1**, `overflow-hidden`, radius do design system.
- Imagem via `next/image` com `fill` + `object-cover` + `sizes` apropriado. O domínio do Supabase já está liberado no `next.config` pelas fotos de produto.
- `alt` descritivo (ex: nome da loja) para acessibilidade.

### Layout de rolagem em `app/[slug]/CatalogoClient.tsx` (duas camadas fixas)

Estrutura no topo da página: **StoreHeader → Capa → Pills de categoria → Grid**.

- `StoreHeader` permanece `sticky top-0` (nome, busca, sacola).
- A **capa** fica logo abaixo, em fluxo normal — rola para fora ao descer.
- A barra de **pills de categoria** passa a ser `sticky` com `top` igual à altura do `StoreHeader`. Como o header tem altura variável (linha de contato aparece condicionalmente), a altura é medida via `ref` + `ResizeObserver` e aplicada por CSS custom property (ex: `--header-h`) usada no `top` das pills.
- Resultado: no repouso vê-se Header → Capa → Pills → Grid; ao rolar, a capa some e as pills grudam logo abaixo do header, preservando busca e filtro sempre acessíveis.

---

## 8. Testes

- **Unitário** para `personalizacaoSchema` (aceita hex válido de 6 dígitos, rejeita inválido) em Vitest, no padrão dos testes de validação existentes.
- **Mapeadores:** garantir que `mapStore` e `resolveCatalog` incluem `coverUrl`. Se houver testes de mapping, estendê-los; senão, verificação manual na vitrine.
- **Sem teste de componente de UI** — o projeto não testa componentes de catálogo/painel hoje.

### Verificação manual (checklist)

1. Aba "Personalização" aparece no sidebar e na tab bar mobile, entre Categorias e Configurações.
2. Configurações não exibe mais o Card "Cor de destaque".
3. Upload de capa → aparece na vitrine entre nome e filtros, proporção 3:1, recortada.
4. Ao rolar, a capa some; header e pills permanecem fixos.
5. Remover capa → some da vitrine.
6. Alterar cor de destaque na nova aba → reflete nos CTAs da vitrine.
7. Loja sem capa não renderiza o bloco (sem espaço vazio).
8. Etapa 2 do cadastro **não** mostra mais a seção "Cor de destaque"; loja recém-criada nasce com Gold Dust e é editável na aba Personalização.

---

## 9. Arquivos afetados (resumo)

**Novos:**
- `supabase/migrations/20260716000000_store_cover.sql`
- `app/painel/personalizacao/page.tsx`
- `app/painel/personalizacao/PersonalizacaoClient.tsx`
- `app/painel/personalizacao/use-personalizacao.ts`
- `app/painel/personalizacao/loading.tsx`
- `components/loja/CapaFields.tsx`
- `components/catalogo/StoreBanner.tsx`

**Modificados:**
- `lib/types.ts`, `lib/catalog.ts`, `lib/server/store.ts`, `lib/server/catalog.ts` (threading de `coverUrl`)
- `lib/validation/painel.ts` (novo `personalizacaoSchema`; `accentColor` sai de `storeSettingsSchema`)
- `app/actions/store.ts` (nova `updatePersonalizacao`; `updateStoreSettings` perde `accentColor`)
- `app/painel/configuracoes/ConfiguracoesClient.tsx` e `use-configuracoes.ts` (remove cor de destaque)
- `components/loja/use-loja-fields.ts` (remove `accent`/`setAccent`)
- `components/painel/Sidebar.tsx`, `components/painel/MobileTabBar.tsx` (novo item de navegação)
- `app/[slug]/CatalogoClient.tsx` (render da capa + duas camadas fixas)
- **Onboarding:** `app/(auth)/cadastro/CadastroForm.tsx` e `use-cadastro-form.ts` (remove seção de cor); `app/actions/auth.ts` (`createStore`/`storeSchema` perdem `accentColor`, default `#C9A96E` no insert)

---

## 10. Fora de escopo (YAGNI)

- Capa clicável / com link.
- Lightbox da capa em tela cheia.
- Múltiplas capas / carrossel.
- Gate de capa por plano.
- Agendamento de exibição (data de início/fim da promoção).
