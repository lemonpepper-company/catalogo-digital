# Domínio próprio no link do catálogo, Dashboard exclusiva de planos pagos e ajustes de landing

**Data:** 2026-07-30
**Status:** Aprovado para planejamento

## Objetivo

Cinco ajustes pequenos e relacionados, levantados numa mesma rodada:

1. Quando a loja tem domínio próprio verificado (recurso Pro, `stores.custom_domain`/`custom_domain_verified`), o link do catálogo exibido no painel deve mostrar o domínio da loja, não `{site}/{slug}`.
2. A Dashboard (`/painel`) deve ficar exclusiva de planos pagos — no plano Free, nada de dashboard é mostrado.
3. Os planos na landing (`app/landing/data.tsx`) devem citar o acesso à Dashboard como recurso pago.
4. O card "Link do catálogo" (com botões Abrir/Copiar) sai da Dashboard.
5. O botão "Cadastrar produto" sai da Dashboard.

Os itens 2, 4 e 5 são consequência direta de "a Dashboard é paga": ao redirecionar quem está no Free para fora da tela, o card de link e o botão de novo produto que sobravam nela deixam de fazer sentido e são removidos (o link do catálogo já vive permanentemente na Sidebar; o botão de novo produto já existe em `/painel/produtos`).

## Escopo

**Dentro:**
- Helper puro `getCatalogUrl(store)` que decide entre domínio próprio e `{site}/{slug}`, usado onde o link do catálogo aparece hoje (Sidebar, Configurações).
- Gate de plano em `/painel` (redirect para `/painel/produtos` no Free, antes de qualquer query) e ocultação do item "Dashboard" na navegação (Sidebar desktop + tab bar mobile) para quem está no Free.
- Duas linhas novas nos planos pagos da landing (Starter e Pro) mencionando a Dashboard.
- Remoção do card "Link do catálogo" e do botão "Cadastrar produto" da `DashboardClient`, e da lógica associada (`copied`/`handleCopy`/prop `catalogUrl` em `use-dashboard.ts`).

**Fora desta rodada:**
- Qualquer mudança na verificação de domínio em si (DNS, `/dominio-pendente`, `DominioField.tsx`) — já funciona e não é tocada.
- Mudar o que a Sidebar mostra no card "Catálogo público em" além do link resolvido (ele continua existindo e visível em todo plano).
- Qualquer novo texto na landing além de citar a Dashboard nas duas listas de features pagas — sem seção nova, sem mockup novo.
- Rebaixamento automático de domínio expirado — já coberto por `getEffectivePlan`/`getPlanLimits`, reaproveitado aqui sem mudança.

## Estratégia

### 1. `getCatalogUrl` — link do catálogo com domínio próprio

Novo arquivo `lib/catalog-url.ts`, função pura (roda em client e server — env `NEXT_PUBLIC_*` é inlined no bundle):

```ts
import { getPlanLimits } from "@/lib/plan-limits";
import type { Plan } from "@/lib/types";

export function getCatalogUrl(store: {
  slug: string;
  plan: Plan;
  trialEndsAt: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
}): string {
  const limits = getPlanLimits(store.plan, store.trialEndsAt);
  if (limits.customDomain && store.customDomainVerified && store.customDomain) {
    return `https://${store.customDomain}`;
  }
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${store.slug}`;
}
```

Se o acesso pago expirar (`getEffectivePlan` cai pra Free) ou o domínio perder a verificação, o helper volta sozinho pro link `/slug` — sem estado solto pra sincronizar.

**Sidebar** (`components/painel/Sidebar.tsx`): hoje computa `catalogHref` internamente a partir de `slug` ([linhas 62-64](../../../components/painel/Sidebar.tsx)). Passa a receber a store inteira (ou os 4 campos usados por `getCatalogUrl` + `name`/`monogram`/`logoUrl`) e chamar `getCatalogUrl(store)` no lugar do cálculo manual. `app/painel/layout.tsx` já tem o objeto `store` completo (`getCurrentStore()`), então só precisa repassar os campos que faltam.

**Configurações** (`app/painel/configuracoes/ConfiguracoesClient.tsx`, [linha 73](../../../app/painel/configuracoes/ConfiguracoesClient.tsx)): já recebe `settings: StoreSettings` inteiro (tem `plan`, `trialEndsAt`, `customDomain`, `customDomainVerified`) — troca o cálculo manual por `getCatalogUrl(settings)`.

### 2. Dashboard exclusiva de planos pagos

**`app/painel/page.tsx`**: gate antes de qualquer I/O, mesmo padrão de `app/painel/pedidos/page.tsx`:

```ts
const store = await getCurrentStore();
if (!store) redirect("/login");

if (getEffectivePlan(store.plan, store.trialEndsAt) === "free") {
  redirect("/painel/produtos");
}
// ...resto igual (query de produtos, getOrderMetrics, etc.)
```

Diferente do gate de Pedidos (que renderiza `RecursoBloqueado`), aqui a decisão do usuário foi redirecionar direto — não há uma versão "bloqueada" da Dashboard, ela simplesmente não existe pra quem está no Free.

**Navegação** (`app/painel/layout.tsx`): já calcula `showUpgradeBanner = getEffectivePlan(...) === "free"` — a mesma variável vira `isFree` e é repassada como prop `hideDashboard={isFree}` para `Sidebar` e `MobileTabBar`.

- `Sidebar.tsx`: `NavItem` "Dashboard" ([linhas 92-97](../../../components/painel/Sidebar.tsx)) só renderiza quando `!hideDashboard`.
- `MobileTabBar.tsx`: ganha prop `hideDashboard: boolean`; `TabItem` "Dashboard" ([linhas 53-58](../../../components/painel/MobileTabBar.tsx)) só renderiza quando `!hideDashboard`.

Resultado: no Free, "Produtos" é o primeiro item da navegação e a home efetiva do painel. Se um lojista Free tiver a URL `/painel` salva (favorito, digitação direta), o redirect no `page.tsx` cobre o acesso direto — a ocultação do nav item sozinha não bastaria.

### 3. Landing — planos citam a Dashboard

Em `app/landing/data.tsx`, adiciona `"Dashboard com métricas de vendas"` a `starterFeatures` ([linha 118](../../../app/landing/data.tsx)) e `proFeatures` ([linha 127](../../../app/landing/data.tsx)), logo após `"Histórico de pedidos"` — a Dashboard é essencialmente a visualização dessas métricas. `freeFeatures` não ganha nenhuma linha nova (ausência = não incluso, mesmo padrão já usado pros demais recursos pagos nessa lista).

### 4. e 5. Remoção do card de link e do botão de novo produto

Em `app/painel/DashboardClient.tsx`:
- Remove o cabeçalho com o `<Link href="/painel/produtos/novo">` ("Cadastrar produto", [linhas 47-56](../../../app/painel/DashboardClient.tsx)) — fica só o título "Olá, {storeName}" e o subtítulo.
- Remove o `<Card>` "Link do catálogo" inteiro ([linhas 112-134](../../../app/painel/DashboardClient.tsx)), incluindo os botões Abrir/Copiar e o import de `ExternalLink`/`Copy`/`Check`/`Button`/`Card` que ficarem sem uso.
- Remove a prop `catalogUrl` de `DashboardClientProps` e do `useDashboard(...)`.

Em `app/painel/use-dashboard.ts`: remove `catalogUrl` do parâmetro, `copied`/`handleCopy`/o `setTimeout` de "copiado" — nada mais consome isso. `toast` só era usado pelo "Link copiado"; se nenhum outro caminho do hook ainda usa `flash`/`toast`, remove os dois também (confirmar ao implementar — não é o foco desta spec, mas é limpeza direta consequente da remoção).

Em `app/painel/page.tsx`: remove o cálculo de `catalogUrl` ([linha 36](../../../app/painel/page.tsx)) e a prop passada pro client.

Nenhuma dessas remoções precisa de substituto: o link do catálogo já é permanente na Sidebar (item 1 acima cobre a resolução de domínio lá) e o botão de novo produto já existe em `/painel/produtos`.

## Testes

- **`catalog-url.test.ts`** (novo): domínio verificado + plano com capability → retorna `https://{domain}`; domínio não verificado, capability ausente (Free/Starter) ou `customDomain` nulo → retorna `{site}/{slug}`; acesso pago expirado (`trialEndsAt` vencido) com domínio ainda gravado → cai pro link de slug (via `getEffectivePlan` dentro do próprio `getPlanLimits`).
- **`Sidebar.test.tsx`** (estender): renderiza domínio próprio quando aplicável; item "Dashboard" ausente quando `hideDashboard`; segue mostrando o link do catálogo em qualquer plano.
- **`ConfiguracoesClient.test.tsx`** (estender): link exibido usa `getCatalogUrl`.
- **`DashboardPage.test.tsx`** (estender): Free redireciona para `/painel/produtos` sem chamar `getOrderMetrics` nem a query de produtos; Starter/Pro seguem renderizando normalmente.
- **`DashboardClient.test.tsx`** (estender/limpar): remove testes do card de link e do botão "Cadastrar produto"; confirma que não sobra espaço/objeto órfão no lugar deles.
- **`MobileTabBar.test.tsx`** (estender): item "Dashboard" ausente quando `hideDashboard`.
- Teste manual no navegador: logar com loja Free e ver `/painel` redirecionar pra Produtos sem o item Dashboard na nav (desktop e mobile); logar com loja Pro com domínio verificado e ver o domínio próprio na Sidebar e em Configurações; conferir a landing exibindo "Dashboard com métricas de vendas" em Starter e Pro.
