'use client'

import { useActionState, useState } from 'react'
import { slugify } from '@/lib/auth/slugify'
import { signUp, createStore } from '@/app/actions/auth'

type FormState = { error: string } | null

export function useCadastroForm(stepLoja: boolean) {
  const [slug, setSlug] = useState('')

  const [state, action, pending] = useActionState<FormState, FormData>(
    stepLoja ? createStore : signUp,
    null
  )

  const handleStoreNameChange = (name: string) => {
    setSlug(slugify(name))
  }

  return {
    slug,
    setSlug,
    handleStoreNameChange,
    state,
    action,
    pending,
  }
}
