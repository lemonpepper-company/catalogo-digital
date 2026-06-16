import { CadastroForm } from './CadastroForm'

export const metadata = {
  title: 'Criar conta — Catálogo Digital',
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>
}) {
  const params = await searchParams
  return <CadastroForm stepLoja={params.step === 'loja'} />
}
