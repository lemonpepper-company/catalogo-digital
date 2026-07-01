# Catálogo Público — Validation Report

**Verdict:** ✅ PASS
**Diff range:** `2cc2bba..2b7b037` (5 commits: fceca3e, 6de6e63, 7bbe835, 9e61b20, 2b7b037)
**Gate:** 120 testes verdes · tsc limpo · eslint limpo · `next build` OK
**Método:** fresh-eyes pass (standalone fallback — sem sub-agente), com verificação runtime end-to-end.

## Cobertura por AC (evidence-or-zero)

| AC | Evidência | Outcome esperado | Status |
| -- | --------- | ---------------- | ------ |
| CAT-01 home renderiza dados reais | runtime `GET /atelie-mira` → 200 com "Ateliê Mira" + produtos; `resolveCatalog` → `__tests__/catalog.test.ts:150` (`r.products[0].category` = "Vestidos", `.price` = "R$ 289,90") | catálogo real renderizado | ✅ |
| CAT-02 pills só com produtos | `catalog.test.ts` computePills — `expect(pills).toEqual(["Todos","Vestidos"])` e `["Todos"]` quando vazio | pills filtradas | ✅ |
| CAT-03 slug inexistente → 404 | runtime `GET /nao-existe-xyz` → 404; `catalog.test.ts` `resolveCatalog(null,...).status === "not_found"` | 404 | ✅ |
| CAT-04 ocultar esgotado/inativo (app) | runtime: HTML de `/atelie-mira` não contém o produto esgotado nem o inativo; query app com `.eq(is_active,true).gt(stock,0)` | omitidos | ✅ |
| CAT-05 ocultar via RLS (anon) | psql `SET ROLE anon`: só `ATIVO_EM_ESTOQUE` visível; seed anon count = 4 (2 ocultos); `pg_policies` qual = `(is_active=true AND stock>0)` | RLS filtra | ✅ |
| CAT-06 detalhe/mapper | `catalog.test.ts` mapPublicProduct — price "R$ 289,90", images[0], placeholder quando vazio, category null→"Todos" | mapeamento correto | ✅ |
| CAT-07 template custom | `utils.test.ts` renderWhatsAppMessage — {saudacao}/{itens}/{total} substituídos; `Total: R$ 250,00` | substituição | ✅ |
| CAT-08 fallback + literal | `utils.test.ts` — template nulo/vazio == buildWhatsAppMessage; `{foo}` mantido literal | fallback §8 exato | ✅ |
| CAT-09 WhatsApp ausente | `BagDrawer.test.tsx` — canCheckout=false ⇒ botão `disabled`, onCheckout não chamado, aviso exibido; hook `handleCheckout` early-return | checkout desabilitado + aviso | ✅ |
| CAT-10 inativa → expiração | runtime: is_active=false ⇒ `/atelie-mira` mostra "indisponível no momento" sem grid; ativa ⇒ catálogo | página de expiração | ✅ |

## Discrimination sensor (mutation testing)

| Mutação | Alvo | Resultado |
| ------- | ---- | --------- |
| `!storeRow.is_active` → `storeRow.is_active` | resolveCatalog | ✅ morto (5 testes falharam) |
| remove fallback de template | renderWhatsAppMessage | ✅ morto (2 testes falharam) |
| `disabled={!canCheckout}` → `disabled={false}` | BagDrawer | ✅ morto (1 teste falhou) |

Todas as mutações revertidas; suíte verde (52/52 nos arquivos afetados, 120/120 total).

## Notas
- **Regra de visibilidade** = `store.is_active` apenas (trial ignorado por ora, AD-003). Cheque de trial (`isTrialActive`) volta com a integração de pagamento (roadmap passo 6).
- **GA/Pixel** e **persistência de sacola em localStorage** fora deste ciclo (AD-004).
- Nenhum SPEC_DEVIATION.
- Ajuste de plano: T5 (CAT-09) implementado; guarda de `handleCheckout` já entregue em T4, prop visual em T5.
