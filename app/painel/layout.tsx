import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: store } = await supabase
    .from('stores')
    .select('trial_ends_at, plan, name, monogram, logo_url, slug')
    .eq('owner_id', user.id)
    .maybeSingle()

  const trialDaysLeft = store?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(store.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const showTrialBanner = !store?.plan

  return (
    <div className="h-screen flex flex-col bg-ivory overflow-hidden">
      {showTrialBanner && (
        <div className="flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 lg:h-10 lg:py-0 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold text-center">
          <span className="font-semibold tracking-[0.02em]">Trial Pro</span>
          <span className="opacity-55">·</span>
          <span>{trialDaysLeft} dias restantes</span>
          <span className="opacity-55">·</span>
          <a
            href="/escolha-de-plano"
            className="font-display font-semibold text-[13.5px] text-gold hover:underline"
          >
            Assinar agora →
          </a>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          name={store?.name ?? ''}
          monogram={store?.monogram ?? null}
          logoUrl={store?.logo_url ?? null}
          slug={store?.slug ?? null}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 pb-24 lg:px-12 lg:py-10 lg:pb-10">{children}</div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  )
}
