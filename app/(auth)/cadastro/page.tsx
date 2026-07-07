import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CadastroForm } from './CadastroForm'

export const metadata = {
  title: 'Criar conta — Vtrine Digital',
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>
}) {
  const params = await searchParams
  const stepLoja = params.step === 'loja'

  // step=loja só existe para quem já confirmou a conta (o middleware redireciona
  // pra cá após o login se ainda não há loja) — sem sessão, não faz sentido expor
  // esse passo nem o endpoint de checagem de slug que ele usa.
  if (stepLoja) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect(`/login?next=${encodeURIComponent('/cadastro?step=loja')}`)
  }

  return <CadastroForm stepLoja={stepLoja} />
}
