# PeriodoFiltro: dropdown + modal de range personalizado

**Data:** 2026-07-30
**Status:** Aprovado para planejamento

## Objetivo

`components/painel/PeriodoFiltro.tsx` (usado em `/painel` e `/painel/pedidos`, ver [2026-07-29-filtro-de-periodo-dashboard-e-pedidos-design.md](2026-07-29-filtro-de-periodo-dashboard-e-pedidos-design.md)) renderiza hoje os 4 presets de período como pills lado a lado + um botão "Personalizado" que revela dois `<input type="date">` inline. Em uso real isso ficou poluído — muitos botões de filtro na tela. Feedback direto após o merge do PR #70: trocar por um dropdown, com o range personalizado escolhido numa modal.

## Escopo

**Dentro:**
- `PeriodoFiltro` passa a renderizar um único dropdown (reaproveitando `components/ui/Select.tsx`, já existente) em vez das pills.
- As 4 opções do dropdown: "Hoje", "7 dias", "Este mês", "Todo período" — mesmos presets, mesma ordem, mesmo default ("Este mês", nunca escrito na URL).
- Ação extra no rodapé do dropdown (`Select`'s prop `footer`, mesmo padrão já usado em "Nova categoria" na tela de Produtos): "Período personalizado", que abre uma modal (reaproveitando `components/ui/Modal.tsx`).
- A modal contém os mesmos dois `<input type="date">` de hoje ("De" / "Até") e um botão "Aplicar" (desabilitado até as duas datas estarem preenchidas). Fechar a modal sem aplicar (X, clique fora, Esc) descarta o rascunho sem alterar o filtro ativo.
- Ao aplicar um range customizado, o valor exibido no dropdown fechado passa a ser o texto abreviado do range (ex: "1 jul – 10 jul"), substituindo o rótulo do preset.
- Nenhuma mudança de props: `PeriodoFiltro` continua recebendo `basePath`, `periodo?`, `de?`, `ate?`, `extraParams?` exatamente como hoje — `DashboardClient.tsx` e `PedidosClient.tsx` não são tocados.
- Nenhuma mudança em `lib/period-filter.ts`, `lib/timezone-sp.ts`, `lib/server/pedidos.ts` ou nas duas páginas (`app/painel/page.tsx`, `app/painel/pedidos/page.tsx`) — a URL como fonte da verdade e a resolução de período continuam idênticas.

**Fora desta rodada:**
- Qualquer biblioteca de datepicker/calendário — os inputs de data continuam sendo `<input type="date">` nativos, só que dentro da modal em vez de inline.
- Mudança na lógica de presets, validação de datas ou timezone (`lib/period-filter.ts` já cobre isso e não muda).
- Ajuste visual em `components/ui/Select.tsx` ou `components/ui/Modal.tsx` além do já suportado por eles hoje.

## Estratégia

### Dropdown (`Select`)

```tsx
<Select
  value={displayValue}          // rótulo do preset ativo, ou o range abreviado quando custom
  options={PRESET_LABELS}        // ["Hoje", "7 dias", "Este mês", "Todo período"]
  onChange={(label) => selectPreset(labelToPreset[label])}
  footer={{ label: "Período personalizado", onClick: () => setModalOpen(true) }}
/>
```

`displayValue` é derivado de `activePeriodToken({ periodo, de, ate })` (já existe, sem mudança): quando o token é um preset, mostra o rótulo do preset; quando é `"custom"`, mostra o range abreviado calculado a partir de `de`/`ate`.

O wrapper mantém `<div role="group" aria-label="Filtrar por período">` ao redor do `Select` — preserva a asserção que `DashboardClient.test.tsx` e `PedidosClient.test.tsx` já fazem (`getByRole("group", { name: "Filtrar por período" })`), então nenhum desses dois arquivos de teste precisa mudar.

### Modal de range personalizado

Reaproveita `<Modal title="Período personalizado" onClose={...}>`, renderizada condicionalmente quando `modalOpen` é `true`. Conteúdo: os mesmos dois `Input type="date"` ("De"/"Até") que já existem hoje, com o mesmo estado local (`customDe`/`customAte`) inicializado a partir de `de`/`ate` quando a modal abre. Botão "Aplicar" chama a mesma `navigate({ de: customDe, ate: customAte })` já existente, e fecha a modal. Fechar sem aplicar (`onClose`) apenas fecha a modal; o estado local do rascunho é reinicializado a partir das props na próxima vez que a modal abrir (não precisa persistir um rascunho descartado).

### Formatação do range abreviado

Função pura nova, local ao arquivo (não exportada — uso interno):

```ts
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDateInputAbbrev(value: string): { day: number; month: string; year: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { day, month: MONTH_ABBR[month - 1], year };
}

function formatCustomRangeLabel(de: string, ate: string): string {
  const from = formatDateInputAbbrev(de);
  const to = formatDateInputAbbrev(ate);
  const fromLabel = from.year === to.year ? `${from.day} ${from.month}` : `${from.day} ${from.month} ${from.year}`;
  const toLabel = `${to.day} ${to.month} ${to.year}`;
  return `${fromLabel} – ${toLabel}`;
}
```

`de`/`ate` chegam no formato `YYYY-MM-DD` (mesmo formato do `value` de um `<input type="date">`), então o parse é um split direto — sem conversão de fuso horário envolvida (são datas de calendário, não instantes). Exemplos: `formatCustomRangeLabel("2026-07-01", "2026-07-10")` → `"1 jul – 10 jul 2026"`; `formatCustomRangeLabel("2025-12-20", "2026-01-05")` → `"20 dez 2025 – 5 jan 2026"`.

## Testes

- **`PeriodoFiltro.test.tsx`** (reescrito): dropdown mostra as 4 opções + a ação de rodapé "Período personalizado"; selecionar cada preset navega com `?periodo=...` (ou sem parâmetro para "Este mês"); clicar em "Período personalizado" abre a modal com os campos De/Até (vazios, ou preenchidos com `de`/`ate` das props quando já há um range customizado ativo); "Aplicar" desabilitado até as duas datas preenchidas; aplicar navega com `?de=...&ate=...` e fecha a modal; fechar a modal sem aplicar não navega; quando `de`/`ate` válidos vêm por prop, o dropdown mostra o range abreviado como valor selecionado em vez do rótulo de um preset; `extraParams` preservados em toda navegação (presets e range customizado).
- **`formatCustomRangeLabel`** (testado indiretamente via o dropdown, não precisa de export/teste unitário próprio — a função é um detalhe de implementação do componente): casos do mesmo ano e de anos diferentes cobertos pelos testes acima.
- **`DashboardClient.test.tsx`** e **`PedidosClient.test.tsx`**: nenhuma mudança esperada (a asserção existente de `role="group"` continua válida).
- Teste manual no navegador: abrir o dropdown, trocar entre presets, abrir a modal, aplicar um range, conferir que o dropdown fechado mostra o range abreviado, reabrir a modal e conferir que os campos vêm preenchidos com o range ativo.
