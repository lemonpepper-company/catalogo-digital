import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/painel/Sidebar'
import { signOut } from '@/app/actions/auth'

export const metadata = {
  title: 'Painel — Catálogo Digital',
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
        <div className="flex-shrink-0 h-10 flex items-center justify-center gap-2 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold whitespace-nowrap">
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
          <div className="px-12 py-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
