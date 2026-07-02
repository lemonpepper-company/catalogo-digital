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
