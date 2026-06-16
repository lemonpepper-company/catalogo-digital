'use client'

import { useState, useActionState } from 'react'
import { signIn } from '@/app/actions/auth'

type FormState = { error: string } | null

export function useLoginForm() {
  const [showPw, setShowPw] = useState(false)
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null)

  return {
    showPw,
    togglePw: () => setShowPw((v) => !v),
    state,
    action,
    pending,
  }
}
