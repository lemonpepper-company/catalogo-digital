# Diferenciação de planos — personalização avançada, domínio próprio e importação de produtos

**Data:** 2026-07-25
**Status:** Aprovado para planejamento de implementação

---

## 1. Contexto e objetivo

Hoje Free, Starter e Pro só diferem em **quantidade** (produtos, categorias, fotos por produto — `lib/plan-limits.ts`). Personalização (cor de destaque + capa), mensagem de pedido customizada e formas de pagamento/entrega são liberadas por igual em qualquer plano — decisão deliberada tomada no design anterior (`2026-07-24-plano-gratuito-e-planos-pagos-manuais-design.md`), quando o objetivo era simplificar e corrigir promessas de marketing nunca implementadas (a landing antiga chegava a citar "Domínio próprio" e "Destaques e relatórios" pro Pro, sem nenhum código por trás).

Agora que o modelo Free + manual está validado, o objetivo muda: dar razões de **capacidade**, não só de quantidade, pra um lojista Free ou Starter querer subir de plano — sem tirar nada de quem já usa o produto hoje.

### Decisão de modelo: gating aditivo

Toda capacidade nova deste documento nasce **exclusiva de Starter/Pro**. Nada do que já existe (cor de destaque, capa, limites atuais) piora ou é retirado do Free. Isso elimina qualquer necessidade de migração ou aviso a lojistas Free existentes, e estende — em vez de substituir — o padrão já usado em `plan-limits.ts` (`getEffectivePlan` / `getPlanLimits`), que segue sendo a única fonte de verdade sobre o que cada loja pode fazer.

---

## 2. Mapa geral de diferenciação por plano

Visão de posicionamento de todos os eixos considerados. Só os marcados como "detalhado nesta spec" ganham desenho técnico abaixo. Os marcados como "Mapeado só" **não são descartados** — são candidatos reais a entrar em produto, cada um exigindo seu próprio ciclo brainstorming → spec → plano quando for a vez (ver §11 para o que é de fato descartado/adiado por escolha, e não só "ainda não chegou a vez").

| Eixo | Free (hoje) | Starter (novo) | Pro (novo) | Nesta spec? |
|---|---|---|---|---|
| Cor de destaque | Paleta atual (16 cores) | igual | igual | — (sem mudança) |
| Pareamento de fonte (5 opções) | Só o padrão | Todas as 5, à escolha | Todas as 5, à escolha | ✅ Detalhado |
| Paleta de fundo (4 opções) | Só o padrão (Ivory) | Todas as 4, à escolha | Todas as 4, à escolha | ✅ Detalhado |
| Formato dos cantos (3 opções) | Só o padrão (atual) | Todas as 3, à escolha | Todas as 3, à escolha | ✅ Detalhado |
| Cor secundária customizada | — | — | Campo livre | ✅ Detalhado |
| Capa da vitrine | Disponível | igual | igual | — (sem mudança) |
| Produtos em destaque | — | até 3 fixados no topo | ilimitado + seção "Novidades" automática | ✅ Detalhado |
| Densidade do grid | Padrão fixo | escolha entre 2 densidades | igual Starter | ✅ Detalhado |
| Domínio próprio | — | — | Disponível | ✅ Detalhado |
| Dashboard de analytics no painel | — | métricas básicas (produtos mais vistos) | métricas completas (cliques em "Comprar", conversão) | ❌ Mapeado só — fora desta rodada por decisão explícita |
| Importação em massa (CSV) | — | — | Disponível (só dados de texto, sem fotos) | ✅ Detalhado |
| Duplicar produto | Disponível | igual | igual | — (fica universal, sem valor de upsell) |
| Cupons/promoções | — | — | Disponível | ❌ Mapeado só |
| Produtos relacionados | — | automático (mesma categoria) | curadoria manual | ❌ Mapeado só |
| Catálogo em PDF | — | — | Disponível | ❌ Mapeado só |

**Independência dos 3 eixos de tema:** revisado durante o brainstorming, com prévias visuais — em vez de um único `theme_preset` combinando cor/fonte, a loja escolhe fonte, fundo e formato dos cantos **separadamente**. Isso evita que lojas no mesmo plano acabem com a mesma cara: com 5 fontes × 4 fundos × 3 formatos × 6 cores de destaque (já livre) × cor secundária livre (Pro), o número de aparências possíveis passa de "5 combinações fixas" pra centenas.

**Landing page:** as listas de features de Starter/Pro na seção de preços (`starterFeatures`/`proFeatures` em `app/landing/data.tsx:112-122`) hoje são só quantitativas ("Até 30 produtos", "5 categorias"...) — nenhuma menciona os diferenciais novos. Cada um dos três planos de implementação inclui uma task final que adiciona uma linha concisa nessas listas, só depois que a respectiva capacidade está pronta (mesmo cuidado já registrado no design anterior, de nunca anunciar na landing algo que o código ainda não faz).

> **Marca/assinatura na mensagem WhatsApp** saiu do mapa: investigando o código, `messageTemplate` já é um campo de texto livre (até 2000 caracteres) editável por qualquer plano hoje — um lojista Free já pode escrever sua própria assinatura no template agora mesmo. Não existe rodapé automático "Catálogo Digital"/"Vtrine" pra remover, e gatear algo que já é livre não teria efeito real. Ver §11.2.

---

## 3. Modelo de dados

### 3.1 Novas colunas em `stores`

```sql
alter table stores add column font_pairing text not null default 'padrao';
alter table stores add column background_palette text not null default 'padrao';
alter table stores add column corner_style text not null default 'padrao';
alter table stores add column secondary_color text;
alter table stores add column grid_density text not null default 'padrao';
alter table stores add column custom_domain text unique;
alter table stores add column custom_domain_verified boolean not null default false;
```

- `font_pairing` / `background_palette` / `corner_style`: três chaves **independentes**, cada uma escolhida separadamente pelo lojista — não um único preset combinado. Não mexem na cor de destaque — essa já é livre pra todo mundo hoje (`accent_color`, paleta de swatches) e continua assim, sem relação com o plano. Os três valores `'padrao'` reproduzem exatamente a aparência que toda loja já tem hoje (Sora + DM Sans, fundo Ivory, cantos atuais) — nenhuma loja existente muda de aparência com esta migration.
- `secondary_color`: nullable, só é lido/aplicado no catálogo quando o plano efetivo é Pro (campo avançado do modelo híbrido).
- `grid_density`: `'padrao'` ou `'compacto'`.
- `custom_domain` / `custom_domain_verified`: domínio apontado pelo lojista e status de verificação (ver §6).

A curadoria em si das opções (paletas de fundo, pares de fonte, valores de raio) é trabalho de implementação alinhado ao `docs/DESIGN_SYSTEM.md`, não decidido aqui — esta spec define o mecanismo (chave → configuração aplicada), não o conteúdo visual exato das opções.

### 3.2 Nova coluna em `products`

```sql
alter table products add column is_featured boolean not null default false;
```

Quantidade de produtos com `is_featured = true` é limitada no server action (não só na UI), pelo mesmo padrão que já valida `maxProducts`/`maxCategories`.

### 3.3 GRANT para o `anon`

`font_pairing`, `background_palette`, `corner_style`, `secondary_color`, `grid_density` e `custom_domain` são lidos pelo catálogo público — cada um entra em `STORE_COLS` (`lib/server/catalog.ts`) **e** precisa de uma migration própria de `grant select`, seguindo o padrão de `20260716190000_grant_anon_cover_url.sql` (regra crítica do `AGENTS.md`). `custom_domain_verified` só é usado no middleware (via cliente com mais privilégio, não pelo catálogo público em si) — não entra no grant do `anon`. `is_featured` em `products` também precisa do grant, já que hoje `PRODUCT_COLS` não inclui todas as colunas — checar e adicionar.

**Descoberta na fase de plano:** `fetchPublicCatalog` (`lib/server/catalog.ts`) roda inteiramente com `createAnonClient()` — não existe cliente com privilégio elevado nesta base. Como o catálogo público precisa saber o **plano efetivo** da loja pra decidir se aplica tema/destaques/densidade (§6), cogitou-se inicialmente adicionar `plan` e `trial_ends_at` ao `STORE_COLS`/grant do `anon`. **Descartado:** o achado de segurança MEDIA-03 (`docs/superpowers/specs/2026-07-06-remediacao-seguranca-design.md`) removeu deliberadamente essas duas colunas do grant do `anon` em 2026-07-09, justamente para impedir que qualquer um consulte plano/expiração de qualquer loja via REST direto — reabrir isso reverteria aquele fix.

**Solução adotada:** uma função Postgres `get_effective_plan(store_id uuid) returns text`, `security definer`, que replica só a regra de expiração já existente em `getEffectivePlan()` (`lib/plan-limits.ts`) e devolve **apenas o plano efetivo já resolvido** (`'free' | 'starter' | 'pro'`) — nunca `trial_ends_at` cru. `anon` ganha `grant execute` na function, não `grant select` nas colunas. `fetchPublicCatalog` chama essa function via `supabase.rpc(...)` e passa o resultado para `getPlanLimits()` (que já existe em TS) — a lógica de *quais* recursos cada plano libera continua 100% em `lib/plan-limits.ts`, uma única fonte de verdade; a function em SQL só resolve a mesma regra de expiração que já é usada em toda a aplicação, sem duplicar as regras de feature flags.

---

## 4. Extensão de `lib/plan-limits.ts`

`PlanLimits` ganha feature flags ao lado dos limites numéricos já existentes:

```ts
export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
  maxFeaturedProducts: number;   // 0 no Free
  themeOptions: boolean;         // libera fonte/fundo/cantos além do padrão
  advancedTheme: boolean;        // campo de cor secundária (Pro)
  gridDensity: boolean;          // escolha de densidade
  customDomain: boolean;         // domínio próprio
  csvImport: boolean;            // importação em massa de produtos
}
```

`FREE_LIMITS` mantém tudo em `false`/`0` (mais `maxFeaturedProducts: 0`). `STARTER_LIMITS` liga `themeOptions`, `gridDensity` e `maxFeaturedProducts: 3`. `PRO_LIMITS` liga tudo, incluindo `advancedTheme`, `customDomain` e `csvImport`, com `maxFeaturedProducts: Infinity`.

Nenhuma mudança estrutural em `getEffectivePlan()` — a carência de renovação (§8) é o único ajuste nessa função.

---

## 5. Painel do lojista

### 5.1 Personalização (`app/painel/personalizacao/`)

Novo card **"Tema"**, acima do card de cor de destaque existente:

- Três seletores independentes — pareamento de fonte, paleta de fundo, formato dos cantos — cada um com suas opções além do padrão aparecendo com cadeado quando o plano efetivo não permite, linkando pro WhatsApp — mesmo padrão do aviso de upgrade já usado no topo do painel Free.
- Campo de cor secundária, visível só quando `advancedTheme` é `true` no plano efetivo.
- Seletor de densidade do grid (2 opções), com o mesmo tratamento de bloqueio quando `gridDensity` é `false`.

Regra de UI: campos bloqueados **aparecem desabilitados com CTA de upgrade**, nunca somem — o lojista precisa ver o que está deixando de usar.

### 5.2 Produtos

Toggle "Destacar na vitrine" (ícone de estrela) na listagem/edição de produto, ao lado do toggle ativo/inativo existente. Ao atingir `maxFeaturedProducts`, o toggle fica desabilitado com a mesma mensagem de limite de plano já usada para produtos/categorias (`docs/roadmap/Escopo.md` §9).

### 5.3 Domínio (nova seção em Configurações)

Campo de texto pro domínio + botão "Verificar" + badge de status (`pendente` / `verificado`) + texto de instrução (registro CNAME/TXT necessário). A ativação real continua manual: o lojista aponta o DNS e avisa por WhatsApp, você adiciona o domínio no projeto Vercel e marca `custom_domain_verified = true` — mesmo fluxo operacional já usado pra liberar Starter/Pro.

### 5.4 Importação de produtos (nova tela em `app/painel/produtos/`)

Botão "Importar planilha" na listagem de produtos, visível só quando `csvImport` é `true` no plano efetivo (senão, cadeado + CTA de upgrade, mesmo padrão dos outros recursos). Fluxo:

1. Link pra baixar um **CSV de exemplo** com o cabeçalho esperado e 1–2 linhas de amostra.
2. Upload do arquivo `.csv` preenchido.
3. Depois do processamento (§7), exibe um resumo: quantos produtos foram criados e, se houver, a lista de linhas com erro e o motivo (ex.: "Linha 5: preço inválido", "Linha 12: limite de produtos do plano atingido").

Sem preview/edição antes de importar — o resumo pós-importação (com o produto já criado) é o ponto de correção; produto criado errado se edita ou apaga normalmente na listagem.

---

## 6. Catálogo público e roteamento de domínio

- `font_pairing`, `background_palette` e `corner_style` resolvem, cada um de forma independente, para variáveis CSS aplicadas na raiz da página — mesmo mecanismo que `accent_color` já usa hoje (`--color-primary` injetado via `style` em `app/[slug]/CatalogoClient.tsx`). Isso exige que `tailwind.config.ts` passe a referenciar os CSS custom properties que `app/globals.css` já declara (`--color-bg`, `--color-surface`, `--color-border`, `--radius-card`, `--radius-btn`) em vez de valores literais — sem mudar a aparência de nenhuma tela hoje. `secondary_color` (quando o plano permite) é aplicada do mesmo jeito, numa variável CSS própria, independente da cor de destaque existente.
- `grid_density` mapeia para uma variação de classe no grid de produtos, sem mudar a estrutura do componente.
- Seção **"Destaques"** aparece no topo da home do catálogo só quando existe ao menos 1 produto com `is_featured = true` — seção condicional, mesmo padrão da linha de contato do header (`docs/DESIGN_SYSTEM.md` §5.6).
- **Domínio próprio:** `middleware.ts` ganha um branch novo — quando o header `Host` da request não é o domínio principal da aplicação, busca a loja por `custom_domain` (com `custom_domain_verified = true`) e faz `rewrite` interno para `/{slug}`, preservando o domínio do lojista na barra de endereço. Domínio cadastrado mas não verificado nunca entra nesse roteamento. Host desconhecido segue o fluxo normal (404).

---

## 7. Importação de produtos via CSV — formato e regras

Escopo desta rodada: **só dados de texto** — nome, preço, categoria, estoque, tamanhos, cores. Fotos continuam sendo adicionadas manualmente depois, produto por produto, como hoje (evita o risco de baixar imagens de URLs arbitrárias colocadas numa planilha).

### 7.1 Formato do CSV

| Coluna | Obrigatório | Formato |
|---|---|---|
| `nome` | Sim | Texto livre |
| `preco` | Sim | Mesmo formato aceito no formulário de produto hoje (ex: `99,90`) |
| `categoria` | Não | Nome da categoria (texto); vazio = produto sem categoria |
| `estoque` | Não | Número inteiro ≥ 0; vazio = `0` |
| `tamanhos` | Não | Lista separada por `;` (ex: `P;M;G`) |
| `cores` | Não | Lista separada por `;`, usando os nomes da paleta preset do produto (`docs/DESIGN_SYSTEM.md` §8 — ex: `Preto;Branco`), comparação case-insensitive |
| `descricao` | Não | Texto livre |

### 7.2 Regras de processamento (server action nova, ex. `importProductsCsv`)

Processa linha a linha, na ordem do arquivo:

1. **Categoria:** resolve por nome (case-insensitive) dentro da loja. Se não existir, **cria automaticamente**, contando pro `maxCategories` do plano efetivo. Se criar a categoria estourasse o limite, a linha vira erro ("limite de categorias do plano atingido") — a categoria não é criada e o produto não é importado.
2. **Cor:** cada nome em `cores` precisa bater com uma cor da paleta preset; nome não reconhecido faz a linha inteira falhar com erro apontando qual cor não foi encontrada.
3. **Limite de produtos:** antes de criar cada produto, verifica `maxProducts` (contagem atual da loja + já criados nesta importação). Ao atingir o limite, essa e todas as linhas seguintes que ainda criariam produto viram erro "limite de produtos do plano atingido" — o processamento continua até o fim do arquivo só para reportar, sem criar mais nada.
4. **Sem verificação de duplicidade:** cada linha válida sempre cria um produto novo, mesmo que já exista um com nome igual (mesmo comportamento que já existe hoje ao cadastrar manualmente). Reimportar o mesmo arquivo duplica — aviso disso no texto de ajuda da tela.
5. Produto importado nasce com `is_active = true`, `is_featured = false`, sem fotos (`images = []`).

Ao final, a action retorna `{ created: number, errors: { line: number; reason: string }[] }`, consumido pelo resumo da UI (§5.4).

---

## 8. Carência de 3 dias ao vencer o plano

Quando `trial_ends_at` de um Starter/Pro liberado manualmente vence, a loja não cai pra Free imediatamente: há uma **carência de 3 dias** antes da queda, dando tempo de renovar sem punição instantânea.

- `getEffectivePlan()` passa a considerar `trial_ends_at + 3 dias` (em vez de `trial_ends_at`) como o corte real de queda pro Free. Mudança de uma linha, sem infraestrutura nova — continua 100% calculado na leitura, sem cron job.
- **Nada é apagado.** Vencida a carência, o sistema só **para de aplicar** o que está fora do Free: o catálogo público renderiza o preset padrão, ignora a cor secundária, esconde a seção "Destaques", volta à densidade padrão — os valores continuam intactos em `stores`/`products`. Renovando (`trial_ends_at` atualizado no Supabase, como já é feito hoje), tudo volta a valer instantaneamente, sem o lojista reconfigurar nada.
- No painel, os cards afetados aparecem bloqueados com "Renove para reativar" em vez de sumirem.
- **Exceção — domínio próprio:** não dá pra simplesmente "parar de aplicar" sem tirar o site do ar pra quem já usa o domínio (ex.: alguém que escaneou um QR code impresso). O roteamento do domínio **continua funcionando** durante e após a carência; a remoção é sempre manual — você tira o domínio do projeto Vercel e zera `custom_domain`/`custom_domain_verified` só quando confirmar que o lojista não vai renovar.

---

## 9. Validação e testes

- Toda escrita nova (server actions) revalida o plano efetivo **no servidor**, não só na UI: gravar `secondary_color` sem ser Pro, marcar destaque além da cota, ou chamar `importProductsCsv` sem `csvImport`, retorna o mesmo tipo de erro já usado para limite de produtos/categorias.
- Domínio: validação de formato (sem `http://`, sem path), unicidade via `unique` na coluna, e o middleware só resolve host com `custom_domain_verified = true`.
- Importação CSV: parsing linha a linha com erro isolado por linha (uma linha ruim não derruba as outras); categoria nova respeitando `maxCategories`; corte exato ao atingir `maxProducts`; cor não reconhecida gera erro apontando a linha.
- `__tests__/plan-limits.test.ts`: novas flags por plano; carência de 3 dias (dentro da janela mantém acesso, depois cai pro Free); nenhum dado apagado, só o efetivo muda.
- Resolução de tema: preset fora do plano efetivo renderiza o padrão; cor secundária ignorada fora do Pro.
- Server actions: rejeição de gravação fora do plano (destaque além da cota, preset bloqueado, domínio sem estar no Pro, CSV sem estar no Pro).
- Middleware: host com domínio verificado → rewrite pro slug certo; não verificado ou desconhecido → fluxo normal.

---

## 10. Arquivos afetados (resumo)

**Novos:**
- `supabase/migrations/*_theme_and_domain_columns.sql` (colunas de `stores` e `products` do §3)
- `supabase/migrations/*_grant_anon_theme_and_domain.sql` (grants do §3.3)
- Opções de tema em `lib/theme-options.ts` (fonte/fundo/cantos, independentes)
- Componente com os 3 seletores de tema (painel)
- Componente/seção de domínio (Configurações)
- Seção "Destaques" no catálogo público (`app/[slug]/`)
- Tela/componente de importação CSV em `app/painel/produtos/` + `importProductsCsv` em `app/actions/produtos.ts`
- CSV de exemplo (asset estático servido no painel)

**Modificados:**
- `lib/plan-limits.ts` (novas flags + carência de 3 dias)
- `lib/types.ts`, `lib/catalog.ts`, `lib/server/store.ts`, `lib/server/catalog.ts` (threading dos campos novos)
- `tailwind.config.ts` (cores/raio de borda passam a referenciar CSS vars, sem mudar valores)
- `app/layout.tsx` (fontes novas via `next/font/google`)
- `app/painel/personalizacao/PersonalizacaoClient.tsx`, `use-personalizacao.ts` (seletores de tema, densidade)
- `app/painel/produtos/*` (toggle de destaque + validação de cota; botão e tela de importação)
- `app/painel/configuracoes/` (seção de domínio)
- `app/actions/store.ts`, `app/actions/produtos.ts` (validação de plano nas escritas novas; nova action de importação)
- `app/[slug]/CatalogoClient.tsx` (aplicação de tema/densidade, seção Destaques)
- `middleware.ts` (roteamento por `custom_domain`)
- `app/landing/data.tsx` (bullets de Starter/Pro)
- `__tests__/plan-limits.test.ts`

---

## 11. Fora de escopo

Duas categorias distintas — não confundir "ainda não chegou a vez" com "decidido não fazer agora".

### 11.1 Candidatos a futuras specs (não descartados, só não é a vez)

Analytics, cupons, produtos relacionados, catálogo em PDF — mapeados na §2 como direção de produto válida. Cada um vira seu próprio ciclo de brainstorming quando for priorizado; nenhum design técnico deles existe ainda.

### 11.2 Descartado nesta rodada (não é "próxima vez", é decisão de escopo)

- **Marca/assinatura na mensagem WhatsApp** — investigação mostrou que `messageTemplate` já é texto livre editável por qualquer plano hoje; não existe rodapé automático pra remover, então gatear isso não teria efeito real. Removido do mapa de diferenciais (§2).
- **Curadoria visual específica das opções de tema** (cores/fontes/raios exatos) — não é um recurso à parte, é detalhe de implementação do que já está desenhado aqui (§3.1); a primeira curadoria concreta (5 fontes, 4 fundos, 3 formatos) já foi validada visualmente com o usuário durante o brainstorming e está pronta pra implementar.
- **Automação de compra/renovação de domínio, SSL manual, ou painel de administração de domínios** — o fluxo manual via Vercel (§5.3, §6) já resolve; não há necessidade prevista de automatizar.
- **Aviso de contagem regressiva antes da carência de 3 dias vencer** — simplicidade deliberada; o lojista só percebe quando os recursos somem do painel/catálogo. Pode virar pedido futuro, mas não está no radar agora.
- **"Duplicar produto" permanece universal em todos os planos, para sempre** — não é candidato a gating; deliberadamente fora de qualquer lista de upsell por ser produtividade barata sem apelo de diferenciação.
- **Importação de fotos via URL na planilha** — risco de baixar conteúdo de URL arbitrária e complexidade de validação fogem do padrão atual de upload direto; fotos continuam manuais mesmo na importação em massa.
- **Atualizar produto existente via importação (match por nome)** — decidido manter só criação, para simplicidade; reimportar duplica, com aviso claro na tela.
