import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentStore } from '@/lib/server/store'
import { getEffectivePlan } from '@/lib/plan-limits'
import { getCatalogUrl } from '@/lib/catalog-url'
import { getPixPendente } from '@/lib/server/assinatura'
import { formatarDataSP, diasAte } from '@/lib/timezone-sp'

/** Banner global só incomoda perto do vencimento — não faz sentido avisar
 * com a antecedência que o Asaas gera a cobrança (até 40 dias, por padrão
 * deles). 3 dias antes espelha a mesma janela da graça que já existe depois
 * do vencimento, então "a partir de 3 dias antes até 3 dias depois" fica
 * uma regra só, fácil de explicar. */
const DIAS_ANTES_DO_VENCIMENTO_PARA_AVISAR = 3
import { Sidebar } from '@/components/painel/Sidebar'
import { MobileTabBar } from '@/components/painel/MobileTabBar'

export const metadata = {
  title: 'Painel — Vtrine Digital',
  robots: { index: false, follow: false },
}

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const store = await getCurrentStore()

  if (!store) {
    redirect('/login')
  }

  const isFree = getEffectivePlan(store.plan, store.planExpiresAt) === 'free'
  const catalogUrl = getCatalogUrl(store)

  // Pix não é débito automático: o Asaas gera a cobrança sozinho a cada
  // ciclo, mas quem paga é o lojista, manualmente. Sem esse aviso em toda
  // página (não só em Assinatura), o lojista só descobre que tem um Pix
  // pendente se lembrar de abrir aquela tela por conta própria — e se
  // esquecer, o acesso é bloqueado quando a graça de 3 dias acaba.
  //
  // Só entra no ar perto do vencimento: o Asaas já gera a cobrança dias
  // (por padrão até 40) antes de vencer, e mostrar o aviso lá atrás seria
  // ruído — o lojista ainda tem tempo de sobra, sem nenhum bloqueio em
  // jogo. `getPixPendente` continua sem esse filtro (é usado também pelo
  // card da própria página de Assinatura, que deve mostrar a cobrança
  // sempre que o lojista for olhar, de propósito).
  const cobrancaPix = await getPixPendente(store.asaasSubscriptionId, store.subscriptionStatus)
  const pixPendente =
    cobrancaPix && diasAte(cobrancaPix.dueDate, new Date()) <= DIAS_ANTES_DO_VENCIMENTO_PARA_AVISAR
      ? cobrancaPix
      : null

  return (
    <div className="h-dvh flex flex-col bg-ivory overflow-hidden">
      {isFree && (
        <div className="flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 lg:h-10 lg:py-0 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold text-center">
          <span className="font-semibold tracking-[0.02em]">Plano Free</span>
          <span className="opacity-55">·</span>
          <span>Fale conosco para liberar mais produtos</span>
          <Link
            href="/painel/assinatura"
            className="font-display font-semibold text-[13.5px] text-gold hover:underline"
          >
            Fazer upgrade →
          </Link>
        </div>
      )}

      {pixPendente && (
        <div className="flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 lg:h-10 lg:py-0 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold text-center">
          <span className="font-semibold tracking-[0.02em]">Pagamento Pix pendente</span>
          <span className="opacity-55">·</span>
          <span>Vencimento em {formatarDataSP(pixPendente.dueDate)} — pague para não perder o acesso</span>
          <a
            href={pixPendente.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display font-semibold text-[13.5px] text-gold hover:underline"
          >
            Pagar agora →
          </a>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          name={store.name}
          monogram={store.monogram}
          logoUrl={store.logoUrl}
          catalogUrl={catalogUrl}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 pb-24 lg:px-12 lg:py-10 lg:pb-10">{children}</div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  )
}
