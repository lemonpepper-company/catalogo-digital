'use client'

import { useActionState, useState } from 'react'
import { signIn } from '@/app/actions/auth'

type FormState = { error: string } | null

export function useLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null)

  return {
    state,
    action,
    pending,
    email,
    setEmail,
    password,
    setPassword,
  }
}
