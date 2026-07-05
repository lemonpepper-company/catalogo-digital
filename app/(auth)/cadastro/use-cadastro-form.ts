'use client'

import { useActionState, useState } from 'react'
import { slugify } from '@/lib/auth/slugify'
import { signUp, createStore } from '@/app/actions/auth'

type FormState = { error: string } | null

export function useCadastroForm(stepLoja: boolean) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [slug, setSlug] = useState('')
  const [instagram, setInstagram] = useState('')

  const [state, action, pending] = useActionState<FormState, FormData>(
    stepLoja ? createStore : signUp,
    null
  )

  const handleStoreNameChange = (name: string) => {
    setStoreName(name)
    setSlug(slugify(name))
  }

  return {
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    storeName,
    handleStoreNameChange,
    slug,
    setSlug,
    instagram,
    setInstagram,
    state,
    action,
    pending,
  }
}
