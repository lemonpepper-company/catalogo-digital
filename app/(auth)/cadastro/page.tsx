import { Suspense } from 'react'
import { CadastroForm } from './CadastroForm'

export const metadata = {
  title: 'Criar conta — Vtrine Digital',
}

async function CadastroFormWithParams({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>
}) {
  const params = await searchParams
  return <CadastroForm stepLoja={params.step === 'loja'} />
}

export default function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>
}) {
  return (
    <Suspense fallback={null}>
      <CadastroFormWithParams searchParams={searchParams} />
    </Suspense>
  )
}
