'use client'

import { useActionState, useState } from 'react'
import { slugify } from '@/lib/auth/slugify'
import { signUp, createStore } from '@/app/actions/auth'
import { useLojaFields } from '@/components/loja/use-loja-fields'

type FormState = { error: string } | null

export function useCadastroForm(stepLoja: boolean) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [slug, setSlug] = useState('')

  const loja = useLojaFields({
    whatsapp: null,
    monogram: null,
    storeDescription: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
  })

  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      if (!stepLoja) return signUp(prev, formData)
      formData.set('instagram', loja.instagram)
      formData.set('paymentMethods', JSON.stringify(loja.paymentMethods))
      formData.set('deliveryMethods', JSON.stringify(loja.deliveryMethods))
      if (loja.logo) formData.set('logo', loja.logo)
      return createStore(prev, formData)
    },
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
    ...loja,
    state,
    action,
    pending,
  }
}
