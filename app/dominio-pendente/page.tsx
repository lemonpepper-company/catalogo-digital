import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Domínio em análise",
  description: "Este domínio foi configurado, mas a verificação ainda está pendente.",
  robots: { index: false, follow: false },
};

/**
 * Página de espera exibida quando o Host da requisição bate com o
 * custom_domain de uma loja que ainda não foi verificada manualmente.
 * O middleware faz rewrite transparente para cá — o visitante continua vendo
 * o domínio do lojista na barra de endereço, e não a landing da Vtrine.
 */
export default function DominioPendentePage() {
  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-4 sm:px-8">
      <div className="max-w-[480px] text-center">
        <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
          Configuração em andamento
        </span>
        <h1 className="font-display font-semibold text-[28px] md:text-[32px] text-obsidian leading-tight tracking-tight mt-3 mb-3">
          Domínio em análise
        </h1>
        <p className="font-body text-[15px] text-graphite">
          Este domínio foi configurado, mas a verificação ainda está pendente.
          Em breve sua vitrine estará disponível aqui.
        </p>
      </div>
    </div>
  );
}
