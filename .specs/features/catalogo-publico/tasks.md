# Catálogo Público — Tasks

**Status: ✅ concluído** — T1–T5 implementadas, commitadas e verificadas (ver validation.md).

Cada task: implementar → gate (testes verdes) → 1 commit atômico. Nunca enfraquecer testes p/ passar.

## Fase 1 — Backend: RLS + camada de dados

### T1 — Migration de leitura pública (CAT-05)
- Criar `supabase/migrations/<ts>_catalog_public_read.sql` com policies public read em `products` (`is_active and stock>0`) e `categories`, + `grant select ... to anon`.
- Aplicar localmente (`supabase migration up` ou reset).
- **Gate/verificação:** consulta com anon key em `products` retorna só ativos+em estoque; `categories` legível. Documentar comando de verificação.
- **Commit:** `feat(catalogo): RLS de leitura pública para produtos e categorias`

### T2 — Camada de dados do catálogo (CAT-01, CAT-02, CAT-03, CAT-06, CAT-10)
- `lib/server/catalog.ts`: `mapPublicStore`, `mapPublicProduct`, `getPublicCatalog(slug)` (slug→null / hidden / visível), montagem de pills (só categorias com produto visível).
- `lib/server/catalog.test.ts`: mappers (cents→string, images vazio→placeholder, category null→"Todos"), visibilidade (trial ativo/expirado/inativa/slug nulo), pills.
- **Gate:** `npm test` verde para o novo arquivo de teste.
- **Commit:** `feat(catalogo): camada de dados pública (mappers + visibilidade)`

## Fase 2 — Mensagem de WhatsApp

### T3 — Render de template da loja (CAT-07, CAT-08)
- `lib/utils.ts`: `DEFAULT_WHATSAPP_TEMPLATE`, `formatItemsBlock`, `renderWhatsAppMessage(template, items)`; reusar formato atual como fallback exato.
- Testes em `lib/utils.test.ts`: template custom, fallback (== formato §8), variável desconhecida literal, multi-item.
- **Gate:** `npm test` verde; testes existentes de `buildWhatsAppMessage` continuam passando.
- **Commit:** `feat(catalogo): render de mensagem WhatsApp a partir do template da loja`

## Fase 3 — Rota, wiring e limpeza

### T4 — Rota `/[slug]` + página de expiração (CAT-01, CAT-02, CAT-03, CAT-04, CAT-10)
- `app/[slug]/page.tsx` (Server Component): `getPublicCatalog` → `notFound()` / `<CatalogExpired/>` / `<CatalogoClient .../>`.
- Portar `CatalogoClient`/`use-catalogo` para `app/[slug]/`, recebendo `store/products/categories` por props (sem `lib/data`).
- `components/catalogo/CatalogExpired.tsx`.
- Remover `app/catalogo/`; ajustar `middleware.ts` (remover exclusão `catalogo` do matcher).
- **Gate:** `npm test` + `npm run build` (rota compila); verificação manual de 404/expiração/visível com dados semeados.
- **Commit:** `feat(catalogo): rota pública /[slug] servindo dados reais`

### T5 — Checkout com template + WhatsApp ausente (CAT-08, CAT-09)
- `use-catalogo`: `handleCheckout` usa `renderWhatsAppMessage(store.messageTemplate, cart)` e `store.whatsapp`; desabilita CTA + aviso quando `!store.whatsapp`.
- Ajuste mínimo em `BagDrawer`/CTA para o estado "sem WhatsApp".
- **Gate:** `npm test`; verificação manual do `wa.me` gerado e do estado desabilitado.
- **Commit:** `feat(catalogo): checkout usa template da loja e trata WhatsApp ausente`

## Verificação final (automática, author ≠ verifier)
Após T5: Verifier independente roda spec-anchored check + discrimination sensor, escreve `validation.md` (PASS/FAIL, evidência por AC, diff range). Gaps viram fix tasks (loop ≤3).

## Cobertura de requisitos
| Req | Tasks |
| --- | ----- |
| CAT-01 | T2, T4 |
| CAT-02 | T2, T4 |
| CAT-03 | T2, T4 |
| CAT-04 | T4 |
| CAT-05 | T1 |
| CAT-06 | T2, T4 |
| CAT-07 | T3 |
| CAT-08 | T3, T5 |
| CAT-09 | T5 |
| CAT-10 | T2, T4 |

Todos os 10 requisitos mapeados. Nenhum órfão.
