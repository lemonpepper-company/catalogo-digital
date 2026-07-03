import { Suspense } from 'react'
import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Entrar — Vtrine Digital',
}

async function LoginFormWithParams({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>
}) {
  const params = await searchParams
  return <LoginForm next={params.next} resetSuccess={params.reset === 'success'} />
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>
}) {
  return (
    <Suspense fallback={null}>
      <LoginFormWithParams searchParams={searchParams} />
    </Suspense>
  )
}
