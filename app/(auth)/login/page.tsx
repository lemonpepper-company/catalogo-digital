import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Entrar — Vtrine Digital',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>
}) {
  const params = await searchParams
  return <LoginForm next={params.next} resetSuccess={params.reset === 'success'} />
}
