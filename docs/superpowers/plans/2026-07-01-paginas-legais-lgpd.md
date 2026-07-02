# Páginas Legais LGPD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar duas páginas públicas estáticas (`/politica-de-privacidade` e `/termos-de-uso`) em conformidade com a LGPD, e linkar ambas no footer da landing page.

**Architecture:** Três alterações independentes — duas novas rotas Next.js como Server Components estáticos sem busca de dados, e uma edição no footer da landing page para incluir links legais. Cada página legal tem navbar mínima, corpo com seções legais e rodapé simples. O componente `Section` é definido localmente em cada arquivo (sem compartilhamento — as páginas são independentes).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v3, Lucide React

## Global Constraints

- Tailwind apenas — sem CSS inline para valores que têm token
- Ícones: Lucide React, outline, `~2px` stroke, import individual (`import { X } from 'lucide-react'`)
- Server Components por padrão — sem `"use client"` nestas páginas
- Sem comentários no código exceto lógica não-óbvia
- `font-display` (Sora) para títulos, `font-body` (DM Sans) para corpo de texto
- Tokens de cor: `bg-ivory`, `text-obsidian`, `text-graphite`, `text-gold`, `border-sand`, `bg-linen`
- Responsável legal: Wagner Azevedo Dutra — contato@vtrinedigital.com.br
- Data de referência: julho de 2026 (1 de julho de 2026)
- Sem `box-shadow` em nenhum componente

---

### Task 1: Página `/politica-de-privacidade`

**Files:**
- Create: `app/politica-de-privacidade/page.tsx`

**Interfaces:**
- Consumes: `components/ui/VtrineLogo` (componente existente)
- Produces: rota pública `/politica-de-privacidade` com 7 seções de conteúdo LGPD

- [ ] **Step 1: Criar `app/politica-de-privacidade/page.tsx`**

```tsx
import type { Metadata } from "next";
import NextLink from "next/link";
import { ArrowLeft } from "lucide-react";
import { VtrineLogo } from "@/components/ui/VtrineLogo";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Saiba como a Vtrine Digital coleta, usa e protege seus dados pessoais em conformidade com a LGPD.",
  robots: { index: true, follow: true },
};

export default function PoliticaDePrivacidadePage() {
  return (
    <div className="min-h-screen bg-ivory">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-sand bg-ivory/[0.92] backdrop-blur">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 h-[72px] flex items-center justify-between">
          <NextLink href="/landing">
            <VtrineLogo size="sm" />
          </NextLink>
          <NextLink
            href="/landing"
            className="inline-flex items-center gap-1.5 font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={16} />
            Início
          </NextLink>
        </div>
      </nav>

      <div className="pt-[72px]">
        <div className="max-w-[720px] mx-auto px-4 sm:px-8 pt-16 pb-10">
          <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
            LGPD · Atualizado em julho de 2026
          </span>
          <h1 className="font-display font-semibold text-[32px] md:text-[40px] text-obsidian leading-tight tracking-tight mt-3 mb-3">
            Política de Privacidade
          </h1>
          <p className="font-body text-[15px] text-graphite">
            Última atualização: 1 de julho de 2026. Esta política descreve como
            a Vtrine Digital coleta, usa e protege suas informações pessoais, em
            conformidade com a Lei Geral de Proteção de Dados (Lei nº
            13.709/2018 — LGPD).
          </p>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 sm:px-8 pb-24">
        <Section title="1. Quem somos">
          <p className="font-body text-[15px] text-graphite">
            O controlador dos dados pessoais coletados por este serviço é{" "}
            <strong>Wagner Azevedo Dutra</strong>, responsável pela plataforma{" "}
            <strong>Vtrine Digital</strong>.
          </p>
          <p className="mt-3 font-body text-[15px] text-graphite">
            Para exercer seus direitos ou tirar dúvidas sobre o tratamento dos
            seus dados, entre em contato pelo e-mail:{" "}
            <a
              href="mailto:contato@vtrinedigital.com.br"
              className="text-obsidian underline underline-offset-2 hover:text-gold transition-colors"
            >
              contato@vtrinedigital.com.br
            </a>
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <p className="font-body text-[15px] text-graphite">
            Coletamos apenas os dados necessários para prestar o serviço:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              "Dados de conta: nome completo e endereço de e-mail (fornecidos no cadastro); senha armazenada em formato de hash seguro gerenciado pelo Supabase.",
              "Dados da loja: nome da loja, endereço público (slug), número de WhatsApp, cor de destaque, logotipo, descrição e monograma.",
              "Dados de produtos: nome, preço, descrição, tamanhos, cores e imagens dos produtos cadastrados.",
              "Dados de uso: plano contratado e data de criação da conta.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="3. Finalidade do tratamento">
          <ul className="flex flex-col gap-2">
            {[
              "Prestação do serviço contratado: criar e exibir o catálogo público de produtos.",
              "Cobrança recorrente da assinatura mensal.",
              "Comunicações transacionais: confirmação de e-mail, recuperação de senha e avisos sobre a conta.",
              "Segurança e melhoria contínua do serviço.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="4. Base legal (LGPD, Art. 7)">
          <ul className="flex flex-col gap-2">
            {[
              "Execução de contrato (inciso V): dados estritamente necessários para operar a plataforma conforme contratado.",
              "Legítimo interesse (inciso IX): segurança da plataforma, prevenção de fraudes e melhoria do serviço.",
              "Consentimento (inciso I): comunicações de marketing, caso o titular opte por recebê-las.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="5. Compartilhamento com terceiros">
          <p className="font-body text-[15px] text-graphite">
            Não vendemos dados pessoais a terceiros. Compartilhamos apenas com
            prestadores de serviço essenciais para operar a plataforma:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              "Supabase: infraestrutura de banco de dados, autenticação e armazenamento de imagens. Os dados são armazenados em servidores com criptografia em trânsito e em repouso.",
              "Processador de pagamento (Stripe ou Pagar.me, a integrar): dados de cobrança necessários para processar a assinatura mensal.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="6. Retenção de dados">
          <p className="font-body text-[15px] text-graphite">
            Seus dados são mantidos enquanto a conta estiver ativa. Após o
            encerramento da conta, os dados serão excluídos em até{" "}
            <strong>30 dias</strong>, salvo obrigação legal que exija retenção
            por prazo superior.
          </p>
        </Section>

        <Section title="7. Seus direitos">
          <p className="font-body text-[15px] text-graphite">
            Nos termos da LGPD (Art. 18), você pode solicitar a qualquer
            momento:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              "Confirmação de que seus dados são tratados.",
              "Acesso aos dados que mantemos sobre você.",
              "Correção de dados incompletos, inexatos ou desatualizados.",
              "Anonimização, bloqueio ou eliminação de dados desnecessários.",
              "Portabilidade dos dados a outro fornecedor de serviço.",
              "Revogação do consentimento para finalidades baseadas nessa base legal.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 font-body text-[15px] text-graphite">
            Para exercer qualquer um desses direitos, envie um e-mail para{" "}
            <a
              href="mailto:contato@vtrinedigital.com.br"
              className="text-obsidian underline underline-offset-2 hover:text-gold transition-colors"
            >
              contato@vtrinedigital.com.br
            </a>
            . Responderemos em até 15 dias úteis.
          </p>
        </Section>
      </div>

      <footer className="border-t border-sand py-8">
        <div className="max-w-[720px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row gap-3 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
          <span>© 2026 Vtrine Digital. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <NextLink
              href="/politica-de-privacidade"
              className="hover:text-obsidian transition-colors"
            >
              Política de Privacidade
            </NextLink>
            <NextLink
              href="/termos-de-uso"
              className="hover:text-obsidian transition-colors"
            >
              Termos de Uso
            </NextLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display font-medium text-[20px] text-obsidian border-b border-sand pb-3 mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Verificar no navegador**

```bash
npm run dev
```

Acessar `http://localhost:3000/politica-de-privacidade` e confirmar:
- Navbar com logo e link "← Início" visíveis e funcionais
- Etiqueta gold "LGPD · Atualizado em julho de 2026" presente
- H1 "Política de Privacidade" renderizado em Sora 600
- 7 seções com divisores `border-sand` separando cada uma
- Bullets gold `·` nas listas de itens
- Links de e-mail clicáveis (`mailto:`)
- Rodapé mínimo com links para as duas páginas legais
- Responsivo: mobile (375px) sem overflow horizontal

- [ ] **Step 3: Commit**

```bash
git add app/politica-de-privacidade/page.tsx
git commit -m "feat: add politica de privacidade page (LGPD)"
```

---

### Task 2: Página `/termos-de-uso`

**Files:**
- Create: `app/termos-de-uso/page.tsx`

**Interfaces:**
- Consumes: `components/ui/VtrineLogo` (componente existente); rota `/politica-de-privacidade` criada na Task 1 (linkada na seção 5)
- Produces: rota pública `/termos-de-uso` com 8 seções de conteúdo

- [ ] **Step 1: Criar `app/termos-de-uso/page.tsx`**

```tsx
import type { Metadata } from "next";
import NextLink from "next/link";
import { ArrowLeft } from "lucide-react";
import { VtrineLogo } from "@/components/ui/VtrineLogo";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Leia os termos e condições de uso da plataforma Vtrine Digital antes de criar sua conta.",
  robots: { index: true, follow: true },
};

export default function TermosDeUsoPage() {
  return (
    <div className="min-h-screen bg-ivory">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-sand bg-ivory/[0.92] backdrop-blur">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 h-[72px] flex items-center justify-between">
          <NextLink href="/landing">
            <VtrineLogo size="sm" />
          </NextLink>
          <NextLink
            href="/landing"
            className="inline-flex items-center gap-1.5 font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={16} />
            Início
          </NextLink>
        </div>
      </nav>

      <div className="pt-[72px]">
        <div className="max-w-[720px] mx-auto px-4 sm:px-8 pt-16 pb-10">
          <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
            Vtrine Digital · Atualizado em julho de 2026
          </span>
          <h1 className="font-display font-semibold text-[32px] md:text-[40px] text-obsidian leading-tight tracking-tight mt-3 mb-3">
            Termos de Uso
          </h1>
          <p className="font-body text-[15px] text-graphite">
            Última atualização: 1 de julho de 2026. Ao criar uma conta ou usar a
            plataforma Vtrine Digital, você concorda com estes Termos de Uso.
            Leia com atenção antes de prosseguir.
          </p>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 sm:px-8 pb-24">
        <Section title="1. Aceitação dos termos">
          <p className="font-body text-[15px] text-graphite">
            O uso da plataforma Vtrine Digital implica a aceitação integral
            destes Termos de Uso. Usuários menores de 18 anos devem ter
            autorização expressa de um responsável legal para criar e manter uma
            conta.
          </p>
        </Section>

        <Section title="2. O serviço">
          <p className="font-body text-[15px] text-graphite">
            A Vtrine Digital disponibiliza uma plataforma online para que
            lojistas criem um catálogo público de produtos e recebam pedidos via
            WhatsApp. A plataforma não intermedia pagamentos, não processa
            cobranças entre lojista e cliente final e não é parte das
            negociações realizadas pelo WhatsApp.
          </p>
        </Section>

        <Section title="3. Cadastro e responsabilidades do lojista">
          <ul className="flex flex-col gap-2">
            {[
              "O lojista é responsável pela veracidade de todas as informações cadastradas na plataforma.",
              "O lojista é responsável pelo conteúdo publicado: fotos, preços, descrições e demais informações dos produtos.",
              "É proibido publicar conteúdo ilegal, ofensivo, enganoso ou que viole direitos de terceiros (incluindo direitos autorais e marcas registradas).",
              "O lojista deve manter suas credenciais de acesso em segurança e não compartilhá-las com terceiros.",
              "Cada conta é pessoal e intransferível.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="4. Planos e pagamento">
          <ul className="flex flex-col gap-2">
            {[
              "Trial: 14 dias gratuitos a partir da data de criação da conta, sem necessidade de cartão de crédito.",
              "Plano Starter: R$ 49/mês — limites de produtos e categorias conforme descrito na página de planos.",
              "Plano Pro: R$ 99/mês — limites ampliados, conforme descrito na página de planos.",
              "A cobrança é recorrente mensal e pode ser cancelada a qualquer momento.",
              "Não há reembolso de períodos parciais já cobrados.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="5. Suspensão e cancelamento">
          <p className="font-body text-[15px] text-graphite">
            A Vtrine Digital pode suspender ou encerrar contas sem aviso prévio
            nos seguintes casos:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              "Inadimplência superior a 30 dias após o vencimento da fatura.",
              "Publicação de conteúdo ilegal ou que viole estes Termos de Uso.",
              "Uso abusivo da plataforma, incluindo spam e automação não autorizada.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 font-body text-[15px] text-graphite">
            O lojista pode cancelar sua conta a qualquer momento pelo painel ou
            pelo e-mail{" "}
            <a
              href="mailto:contato@vtrinedigital.com.br"
              className="text-obsidian underline underline-offset-2 hover:text-gold transition-colors"
            >
              contato@vtrinedigital.com.br
            </a>
            . Após o cancelamento, os dados serão excluídos conforme a{" "}
            <NextLink
              href="/politica-de-privacidade"
              className="text-obsidian underline underline-offset-2 hover:text-gold transition-colors"
            >
              Política de Privacidade
            </NextLink>
            .
          </p>
        </Section>

        <Section title="6. Limitação de responsabilidade">
          <p className="font-body text-[15px] text-graphite">
            A Vtrine Digital não se responsabiliza por:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {[
              "Negociações, pagamentos ou disputas entre lojista e cliente final realizadas pelo WhatsApp.",
              "Indisponibilidade temporária do serviço decorrente de manutenção programada ou falha de infraestrutura de terceiros.",
              "Perdas indiretas, lucros cessantes ou danos emergentes decorrentes do uso ou impossibilidade de uso da plataforma.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 font-body text-[15px] text-graphite"
              >
                <span className="text-gold font-semibold mt-0.5 flex-shrink-0">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="7. Alterações nos termos">
          <p className="font-body text-[15px] text-graphite">
            Podemos atualizar estes Termos de Uso a qualquer momento. Para
            alterações relevantes, enviaremos um aviso por e-mail com
            antecedência mínima de <strong>15 dias</strong>. O uso continuado da
            plataforma após esse prazo implica aceitação das alterações.
          </p>
        </Section>

        <Section title="8. Foro">
          <p className="font-body text-[15px] text-graphite">
            Fica eleito o foro do domicílio do contratante para dirimir
            quaisquer controvérsias decorrentes destes Termos de Uso, nos termos
            do Código de Defesa do Consumidor (Lei nº 8.078/1990).
          </p>
        </Section>
      </div>

      <footer className="border-t border-sand py-8">
        <div className="max-w-[720px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row gap-3 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
          <span>© 2026 Vtrine Digital. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <NextLink
              href="/politica-de-privacidade"
              className="hover:text-obsidian transition-colors"
            >
              Política de Privacidade
            </NextLink>
            <NextLink
              href="/termos-de-uso"
              className="hover:text-obsidian transition-colors"
            >
              Termos de Uso
            </NextLink>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display font-medium text-[20px] text-obsidian border-b border-sand pb-3 mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Verificar no navegador**

Acessar `http://localhost:3000/termos-de-uso` e confirmar:
- Navbar com logo e link "← Início" visíveis e funcionais
- H1 "Termos de Uso" renderizado em Sora 600
- 8 seções com divisores `border-sand`
- Link para `/politica-de-privacidade` funcional na seção 5
- Link de e-mail clicável (`mailto:`)
- Rodapé mínimo com links para as duas páginas legais
- Responsivo: mobile (375px) sem overflow horizontal

- [ ] **Step 3: Commit**

```bash
git add app/termos-de-uso/page.tsx
git commit -m "feat: add termos de uso page"
```

---

### Task 3: Links legais no footer da landing page

**Files:**
- Modify: `app/landing/page.tsx`

**Interfaces:**
- Consumes: rotas `/politica-de-privacidade` e `/termos-de-uso` criadas nas Tasks 1 e 2
- Produces: footer da landing com coluna "Legal" no grid e links na barra inferior

- [ ] **Step 1: Adicionar coluna "Legal" no grid do footer**

Em `app/landing/page.tsx`, localizar a abertura do grid do footer e mudar de 4 para 5 colunas:

```tsx
{/* Trocar: */}
<div className="grid grid-cols-2 md:grid-cols-4 pb-12 gap-8">

{/* Por: */}
<div className="grid grid-cols-2 md:grid-cols-5 pb-12 gap-8">
```

Após a coluna "Empresa" (que tem links "Sobre", "Depoimentos", "Contato") e antes da coluna "Conta", inserir:

```tsx
<div>
  <h4 className="font-display font-medium text-[13px] text-obsidian mb-4">
    Legal
  </h4>
  <div className="flex flex-col gap-[11px]">
    <NextLink
      href="/politica-de-privacidade"
      className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
    >
      Política de Privacidade
    </NextLink>
    <NextLink
      href="/termos-de-uso"
      className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
    >
      Termos de Uso
    </NextLink>
  </div>
</div>
```

- [ ] **Step 2: Substituir "Feito no Brasil" por links legais na barra inferior**

Localizar o `<div className="border-t border-sand pt-7 ...">` no final do footer e substituir:

```tsx
{/* Trocar: */}
<div className="border-t border-sand pt-7 flex flex-col sm:flex-row gap-2 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
  <span>© 2026 Vtrine Digital. Todos os direitos reservados.</span>
  <span>Feito no Brasil</span>
</div>

{/* Por: */}
<div className="border-t border-sand pt-7 flex flex-col sm:flex-row gap-2 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
  <span>© 2026 Vtrine Digital. Todos os direitos reservados.</span>
  <div className="flex items-center gap-4">
    <NextLink
      href="/politica-de-privacidade"
      className="hover:text-obsidian transition-colors"
    >
      Política de Privacidade
    </NextLink>
    <NextLink
      href="/termos-de-uso"
      className="hover:text-obsidian transition-colors"
    >
      Termos de Uso
    </NextLink>
  </div>
</div>
```

- [ ] **Step 3: Verificar no navegador**

Acessar `http://localhost:3000/landing` e rolar até o footer. Confirmar:
- Coluna "Legal" visível com dois links no grid (desktop)
- Links "Política de Privacidade" e "Termos de Uso" na barra inferior (no lugar de "Feito no Brasil")
- Clicar em cada link navega para a página correta
- Em mobile (375px): grid de 2 colunas preservado, coluna Legal aparece em linha própria

- [ ] **Step 4: Commit**

```bash
git add app/landing/page.tsx
git commit -m "feat: add legal links to landing footer"
```

---

## Self-Review

**Spec coverage:**
- [x] `/politica-de-privacidade` — Task 1
- [x] `/termos-de-uso` — Task 2
- [x] Footer da landing com coluna "Legal" — Task 3 Step 1
- [x] Footer com links na barra inferior — Task 3 Step 2
- [x] `metadata` em cada page — Tasks 1 e 2
- [x] Controlador: Wagner Azevedo Dutra, contato@vtrinedigital.com.br — Tasks 1 e 2
- [x] 7 seções LGPD na política de privacidade — Task 1
- [x] 8 seções nos termos de uso — Task 2
- [x] Navbar mínima com logo + "← Início" — Tasks 1 e 2
- [x] Rodapé mínimo com links legais — Tasks 1 e 2
- [x] Server Components estáticos (sem `"use client"`) — confirmado
- [x] Nenhum ajuste no middleware necessário — confirmado (rotas públicas por padrão)

**Placeholders:** nenhum. Todo o conteúdo legal está inline completo.

**Type consistency:** `Section` component definido com a mesma assinatura `{ title: string; children: React.ReactNode }` em ambas as páginas — OK.
