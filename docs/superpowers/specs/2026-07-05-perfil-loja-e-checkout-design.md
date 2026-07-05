# Design — Perfil social da loja e checkout com pagamento/entrega

**Data:** 2026-07-05
**Status:** Aprovado, aguardando plano de implementação

## Contexto

Pacote de melhorias que:
1. Permite ao lojista cadastrar Instagram (além do WhatsApp já existente).
2. Exibe nome, descrição e links de contato (WhatsApp/Instagram) na página pública do catálogo.
3. Permite ao lojista configurar quais formas de pagamento e de entrega aceita, e exige que o cliente escolha entre elas no checkout via WhatsApp.
4. Atualiza o template de mensagem do WhatsApp para incluir essas novas informações.
5. Atualiza a documentação (`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`) para refletir as mudanças.

Motivação: hoje o catálogo público não passa confiança institucional (sem descrição/redes sociais visíveis) e o pedido enviado via WhatsApp não informa como o cliente vai pagar ou receber o produto, gerando idas e voltas manuais entre lojista e cliente.

## 1. Modelo de dados

Nova migration em `supabase/migrations/` adicionando três colunas em `stores`:

| Coluna | Tipo | Default | Valores possíveis |
|---|---|---|---|
| `instagram` | `text` | `null` | usuário do Instagram, sem o `@` (ex: `"atelieming"`) |
| `payment_methods` | `text[]` | `'{}'` | subconjunto de `pix`, `cartao`, `dinheiro` |
| `delivery_methods` | `text[]` | `'{}'` | subconjunto de `retirada`, `entrega` |

- Lojas existentes (e novas lojas que não mexerem nessa configuração) nascem com os arrays vazios — o checkout continua **exatamente** como hoje (sem seletor de pagamento/entrega) até o lojista habilitar manualmente ao menos uma opção de cada grupo.
- Nenhuma mudança de RLS necessária — mesmas políticas já existentes na tabela `stores` (dono lê/escreve a própria loja, leitura pública via slug).

## 2. Instagram — cadastro e configurações

Campo `instagram`, texto livre opcional, com prefixo visual `@` (mesmo padrão do prefixo `+55` do campo WhatsApp) e label indicando "(opcional)". Normalizado no backend removendo `@` se o usuário colar com ele.

- **Cadastro** (`/cadastro?step=loja`, `CadastroForm.tsx`): adicionado na seção "Sua loja", junto com nome e slug da loja. `storeSchema` (em `app/actions/auth.ts`) e `createStore` passam a aceitar o campo.
- **Configurações** (`/painel/configuracoes`, `ConfiguracoesClient.tsx`): adicionado no card "Identidade", junto com WhatsApp/monograma/descrição. `storeSettingsSchema` (`lib/validation/painel.ts`) e `updateStoreSettings` (`app/actions/store.ts`) passam a aceitar e persistir o campo.
- `lib/types.ts`: `Store.instagram?: string` e `StoreSettings.instagram: string | null`.

## 3. Catálogo público — header expandido

`StoreHeader` (`components/catalogo/StoreHeader.tsx`) ganha duas linhas novas abaixo do nome da loja, cada uma renderizada apenas se houver conteúdo:

```
[Logo] Nome da Loja                    🔍 🛍
       Descrição curta da loja
       📱 WhatsApp   📷 Instagram
```

- **Descrição**: `store.description`, omitida se vazia.
- **Link WhatsApp**: ícone Lucide `MessageCircle` + label "WhatsApp". Abre `https://wa.me/{numero normalizado}` **sem mensagem pré-preenchida** — é contato geral, diferente do botão "Enviar pedido via WhatsApp" da sacola (que carrega o pedido). Omitido se `store.whatsapp` vazio.
- **Link Instagram**: ícone Lucide `Instagram` + `@usuario`. Abre `https://instagram.com/{usuario}` em nova aba. Omitido se `store.instagram` vazio.
- Se nenhum dos dois links estiver configurado, a linha inteira de links não renderiza (sem espaço vazio reservado).
- `lib/catalog.ts` (`mapPublicStore`) e `lib/server/catalog.ts` (`STORE_COLS`) passam a incluir e mapear a coluna `instagram`.

## 4. Configurações — nova seção "Pagamento e entrega"

Novo card em `/painel/configuracoes`, abaixo do card "Mensagem do pedido":

```
Pagamento e entrega
· o cliente só vê essas opções no checkout se você marcar ao menos uma aqui

Formas de pagamento aceitas
[Switch] Pix
[Switch] Cartão
[Switch] Dinheiro

Formas de entrega
[Switch] Retirar no local
[Switch] Enviar no endereço
```

- Reaproveita o componente `Switch` já existente — uma linha por opção, permitindo seleção múltipla independente por grupo.
- Sem mínimo obrigatório: lojista pode deixar os dois grupos vazios (mantém comportamento atual) ou habilitar só um dos grupos.
- `use-configuracoes.ts` ganha estado `paymentMethods: string[]` e `deliveryMethods: string[]`.
- `storeSettingsSchema` valida que os valores enviados pertencem aos enums fixos (`pix`/`cartao`/`dinheiro` e `retirada`/`entrega`).

## 5. Checkout — sacola (`BagDrawer`)

Novos campos no rodapé da sacola, entre o total e o botão de envio:

```
Total                         R$ 199,00

Forma de pagamento                      ← aparece se payment_methods.length ≥ 1
( ) Pix   ( ) Cartão   ( ) Dinheiro     (só as habilitadas pela loja aparecem)

Entrega                                 ← aparece se delivery_methods.length ≥ 1
( ) Retirar no local
( ) Enviar no endereço
   └─ [ endereço completo........... ]  ← só se "Enviar no endereço" selecionado

[ Enviar pedido via WhatsApp → ]
```

**Regras:**
- Grupo com **0 opções configuradas** pela loja → não aparece (comportamento atual, sem mudança).
- Grupo com **1+ opções configuradas** → sempre aparece, **nenhuma opção vem pré-selecionada** (mesmo havendo uma única opção) — padroniza com o comportamento já existente de seleção de tamanho/cor em `ProductDetail.tsx`, onde o cliente sempre precisa tocar para selecionar.
- O botão "Enviar pedido via WhatsApp" só libera quando cada grupo visível (pagamento e/ou entrega) tiver uma opção selecionada pelo cliente.
- Se "Enviar no endereço" for a opção selecionada, o campo de endereço (texto livre) também é obrigatório para liberar o botão.
- Estado (`selectedPayment`, `selectedDelivery`, `address`) vive só em `use-catalogo.ts` — não é persistido em banco (não existe tabela de pedidos); usado apenas para montar a mensagem do WhatsApp.

## 6. Mensagem do WhatsApp — novos tokens

Dois novos tokens no sistema de template já existente (`{saudacao}`, `{itens}`, `{total}`):

| Token | Resolve para | Se grupo não configurado pela loja |
|---|---|---|
| `{pagamento}` | `"Forma de pagamento: Pix"` | `""` (vazio) |
| `{entrega}` | `"Entrega: Retirar no local"` ou `"Entrega: Enviar no endereço — Rua X, 123"` | `""` (vazio) |

**Template padrão atualizado** (`MSG_DEFAULT` em `use-configuracoes.ts`, e fallback em `lib/utils.ts`):

```
{saudacao}

{itens}

{pagamento}

{entrega}

━━━━━━━━━━━━━━━━━
*Total: {total}*
━━━━━━━━━━━━━━━━━
```

- `MSG_VARS` (painel de configurações) ganha as duas novas variáveis, inseríveis/reposicionáveis pelo lojista como as já existentes.
- **Regra de limpeza:** como `{pagamento}`/`{entrega}` podem resolver para string vazia, `renderWhatsAppMessage` (`lib/utils.ts`) passa a colapsar sequências de 3+ quebras de linha em uma única linha em branco e remover espaços em branco nas pontas da mensagem final — uma loja que não usa esses grupos não manda mensagem com linhas ou blocos vazios soltos.
- Novas funções `formatPaymentLine()` e `formatDeliveryLine()` em `lib/utils.ts`, seguindo o mesmo padrão de `formatItemsBlock()` já existente.

## 7. Documentação

- **`docs/ARCHITECTURE.md`**: schema da tabela `stores` (colunas `instagram`, `payment_methods`, `delivery_methods`), tabela de arquivos importantes (novas funções em `lib/utils.ts`), e a seção "Estado atual" ganha uma linha sobre o checkout com pagamento/entrega configuráveis.
- **`docs/DESIGN_SYSTEM.md`**: padrão de "linha de links" no header do catálogo (ícone + label, Lucide `MessageCircle`/`Instagram`), e o padrão de seletor de opção no rodapé da sacola (reaproveitando o estilo de chips já usado em tamanho/cor).
- **`docs/CONVENTIONS.md`**: sem mudanças de convenção — os padrões usados (Server Actions, Zod, hooks `use-*`, `Switch`, chips de seleção) já estão documentados e apenas se aplicam a essas novas telas.

## Fora de escopo

- Integração de pagamento real (Pix/cartão continuam sendo apenas informativos — o pagamento em si acontece fora do sistema, combinado via WhatsApp).
- Cálculo de frete ou taxa de entrega.
- Persistência de pedidos em banco (segue sem tabela de pedidos — todo o fluxo é stateless até a abertura do WhatsApp).
- Validação de formato do endereço (campo de texto livre, sem CEP/autocomplete).
