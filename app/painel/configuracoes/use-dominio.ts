"use client";

import { useActionState, useState } from "react";
import { updateCustomDomain } from "@/app/actions/store";
import type { StoreSettings, ToastState } from "@/lib/types";

type State = { error: string } | { ok: true } | null;

export function useDominio(settings: StoreSettings) {
  const [domain, setDomain] = useState(settings.customDomain ?? "");
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  // O estado do useActionState não é consumido: o feedback ao lojista vem do
  // toast disparado dentro da própria action abaixo.
  const [, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("customDomain", domain);
      const res = await updateCustomDomain(prev, formData);
      if (res && "ok" in res) flash("Domínio salvo — aguardando verificação");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  return { domain, setDomain, formAction, pending, toast };
}
