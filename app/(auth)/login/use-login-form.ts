'use client'

import { useActionState } from 'react'
import { signIn } from '@/app/actions/auth'

type FormState = { error: string } | null

export function useLoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null)

  return {
    state,
    action,
    pending,
  }
}
