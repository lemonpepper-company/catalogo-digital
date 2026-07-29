# Ajustes de personalização, upsell e polimento de UI

**Data:** 2026-07-29
**Status:** Aprovado para planejamento de implementação

---

## 1. Contexto e objetivo

Lote de 7 ajustes pontuais levantados em uso real do painel e do catálogo público, sem relação arquitetural entre si — a maioria é reorganização visual, correção de texto ou um bug de preview. O fio condutor é consertar avisos de upsell (Free/Starter/Pro) que hoje estão inconsistentes ou ausentes, e alguns polimentos visuais soltos (blur de modal, tooltip, link de suporte).

Este documento cobre os 7 itens abaixo. Um oitavo item (recolorir badges de produto com a cor secundária) foi **removido do escopo** por decisão do usuário — a cor secundária continua se aplicando só à pill de categoria ativa, como hoje; fica para uma spec futura.

---

## 2. Decisão transversal: componente `UpsellHint`

Hoje existem dois textos de upsell hardcoded em lugares diferentes do painel:
- `components/painel/ThemeOptionsFields.tsx:129` — link "Disponível no Starter — fale conosco", específico das opções de tema (`themeOptions`).
- `app/painel/categorias/CategoriasClient.tsx:52-54` — `<span>` estático "Limite de {maxCategories} atingido — faça upgrade", sem link.

Nenhum dos dois é reutilizável, e essa duplicação é a causa raiz da inconsistência do item 4 (cor secundária): o campo de cor secundária (gate Pro, `advancedTheme`) não tinha nenhum aviso próprio — só "pegava carona" visualmente no aviso de tema (gate Starter, `themeOptions`), então sumia por completo sempre que `themeOptions` já estava liberado (plano Starter).

**Decisão**: criar `components/painel/UpsellHint.tsx`, componente único parametrizado por plano exigido:

```tsx
interface UpsellHintProps {
  plan: "Starter" | "Pro";
  className?: string;
}

export function UpsellHint({ plan, className }: UpsellHintProps) {
  // "Disponível no {plan} — fale conosco", link para wa.me/{VTRINE_WHATSAPP_NUMBER}
}
```

Usado nos itens 4 e 8 abaixo. `ThemeOptionsFields.tsx` passa a consumir `<UpsellHint plan="Starter" />` no lugar do link hardcoded atual (mesmo texto e destino, agora com fonte única).

---

## 3. Componente `Tooltip`

Não existe nenhum primitivo de tooltip no projeto — todo o design system é Tailwind customizado do zero, sem Radix/shadcn. Criar `components/ui/Tooltip.tsx`, sem dependência nova:

- Wrapper `group relative` em volta do elemento disparador (o próprio botão bloqueado).
- Balão posicionado `absolute`, `opacity-0 group-hover:opacity-100` + transição, estilo consistente com os tokens existentes (sem `box-shadow`, cores do design system).
- Texto do tooltip é sempre o mesmo do `UpsellHint` correspondente ("Disponível no Starter" / "Disponível no Pro"), para nunca ficarem dessincronizados — mesma string, duas apresentações (hover vs. texto persistente).

Aplicado nos botões bloqueados de: opções de tema (`OptionRow` em `ThemeOptionsFields.tsx`), swatches de cor secundária (item 4), e botão de densidade "Compacto" (`PersonalizacaoClient.tsx`).

---

## 4. Cor secundária: mover de card e corrigir aviso de upsell

**Mover**: o bloco de cor secundária (`PersonalizacaoClient.tsx:58-88`, hoje dentro do card "Tema", condicionado a `advancedTheme`) passa a viver dentro do card **"Cor de destaque"**, logo abaixo dos swatches de `CorDestaqueFields`. O card "Tema" fica só com as opções gated por Starter (fonte/paleta/cantos) + densidade do grid — cada card volta a representar um único gate de plano.

**Corrigir aviso**: quando `!limits.advancedTheme` (cobre Free **e** Starter, já que o gate real é Pro):
- Swatches de cor secundária renderizam **desabilitados** (`opacity-50`, `cursor-not-allowed`, ícone de cadeado — mesmo padrão visual do `OptionRow`) em vez de o bloco inteiro sumir como hoje.
- Abaixo dos swatches, `<UpsellHint plan="Pro" />` (item 2) — aviso persistente, sempre visível quando bloqueado, em qualquer plano abaixo de Pro.
- Tooltip (item 3) no hover de cada swatch desabilitado, reforçando a mesma informação.

Quando `advancedTheme` é `true` (Pro), comportamento idêntico ao atual (swatches interativos, sem aviso).

---

## 5. Bug do bloco em branco no template de WhatsApp

Investigação: `renderWhatsAppMessage` (`lib/utils.ts:114`), que monta a mensagem **realmente enviada**, já resolve corretamente hoje — `formatPaymentLine`/`formatDeliveryLine` retornam string vazia quando o método não está configurado, e `collapseBlankLines` (linha 58) absorve as quebras de linha extras resultantes. Simulação direta do template padrão com pagamento/entrega desativados confirma que não sobra bloco vazio nesse caminho.

**Causa real**: o preview de Configurações (`app/painel/configuracoes/ConfiguracoesClient.tsx`, função `renderTemplate` + `MSG_MOCK`) é uma implementação **paralela e simplificada** — sempre injeta valores fixos (`"Forma de pagamento: Pix"`, `"Entrega: Retirar no local"`), nunca reflete os métodos reais habilitados pela loja, e não chama `collapseBlankLines`. O lojista nunca vê no preview o que acontece quando desativa pagamento/entrega, porque o preview simula um estado que nem sempre é o real.

**Fix**: `renderTemplate` passa a chamar a mesma lógica de `renderWhatsAppMessage`/`formatPaymentLine`/`formatDeliveryLine`, usando os métodos **realmente habilitados** na loja (`f.paymentMethods`/`f.deliveryMethods`, já disponíveis no hook `useConfiguracoes`) em vez dos valores fixos de `MSG_MOCK`. Preview passa a bater exatamente com a mensagem que o cliente recebe, incluindo o colapso de linhas quando algum método não está ativo.

**Risco em aberto**: se depois do fix ainda aparecer bloco vazio numa mensagem *real* enviada (não só no preview antigo), é sinal de um template customizado que embute um rótulo antes da variável (ex.: `"Forma de entrega: {entrega}"`) — nesse caso a linha resultante (`"Forma de entrega: "`) não é pura quebra de linha e o `collapseBlankLines` não a remove. Esse caso **não está coberto** por este fix; se ocorrer, tratar como bug separado.

---

## 6. Blur no modal de produto (desktop)

`app/[slug]/CatalogoClient.tsx:140` — overlay do modal de produto no desktop é `md:bg-black/50`, sólido e sem blur. Trocar para `md:bg-black/20 md:backdrop-blur-md` (valores finais ajustáveis na implementação para legibilidade), no mesmo padrão de blur já usado em `ProductImageLightbox` e no botão voltar do `ProductDetail` (`backdropFilter: blur(...)`). Mobile não muda — é tela cheia, sem overlay atrás.

---

## 7. Link de suporte na área logada

- **Desktop**: `components/painel/Sidebar.tsx`, bloco fixo do rodapé (`mt-auto`, onde já ficam o link do catálogo público e "Sair") ganha um item "Suporte", ícone + link para `wa.me/{VTRINE_WHATSAPP_NUMBER}` (`lib/contact.ts`, mesmo número já usado nos upsells).
- **Mobile**: em vez de mexer no `MobileTabBar` (já ocupado com 6 abas), o link de suporte é adicionado ao final da página de Configurações (`app/painel/configuracoes/ConfiguracoesClient.tsx`, abaixo do último card), visível em qualquer largura de tela — local de fácil acesso sem exigir um novo padrão de navegação mobile.

---

## 8. Mensagem "Limite de 5 atingido" (categorias)

`app/painel/categorias/CategoriasClient.tsx:52-54` — hoje um `<span>` estático sem link, texto diferente do usado no erro do server action (`app/actions/categorias.ts:38`, "Limite de categorias do seu plano atingido. Fale conosco para aumentar o limite."). Trocar pelo `UpsellHint` (item 2), unificando texto entre UI e mensagem de erro, e tornando-o um link clicável para o WhatsApp — igual aos demais avisos de upsell do painel, em vez de texto morto.

---

## 9. Fora de escopo

- Recolorir badges de produto ("Novo"/"Esgotado") com a cor secundária — adiado, revisão futura.
- Link de suporte no `MobileTabBar` como item de navegação próprio — resolvido via página de Configurações neste pacote; um item de tab bar dedicado pode ser considerado depois, se necessário.
- Qualquer correção ao `md:shadow-2xl` do modal de produto (`CatalogoClient.tsx:146`), que tecnicamente diverge da convenção "sem box-shadow" do design system — fora do pedido original, não mexido aqui.
