import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentStore } from '@/lib/server/store'
import { getEffectivePlan } from '@/lib/plan-limits'
import { getCatalogUrl } from '@/lib/catalog-url'
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
