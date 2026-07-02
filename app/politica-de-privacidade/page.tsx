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
              href="mailto:w3dev.support@gmail.com"
              className="text-obsidian underline underline-offset-2 hover:text-gold transition-colors"
            >
              w3dev.support@gmail.com
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
              href="mailto:w3dev.support@gmail.com"
              className="text-obsidian underline underline-offset-2 hover:text-gold transition-colors"
            >
              w3dev.support@gmail.com
            </a>
            . Responderemos em até 15 dias úteis.
          </p>
        </Section>
      </div>

      <footer className="border-t border-sand py-8">
        <div className="max-w-[720px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row gap-3 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
          <span>© 2026 Vtrine Digital. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <span className="text-obsidian font-medium cursor-default">Política de Privacidade</span>
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
