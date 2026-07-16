"use client";

import { useActionState, useState, useRef } from "react";
import { updateStoreSettings } from "@/app/actions/store";
import { useLojaFields } from "@/components/loja/use-loja-fields";
import type { StoreSettings, ToastState } from "@/lib/types";

export const MSG_DEFAULT = `{saudacao}\n\n{itens}\n\n{pagamento}\n\n{entrega}\n\n━━━━━━━━━━━━━━━━━\n*Total: {total}*\n━━━━━━━━━━━━━━━━━`;

export const MSG_VARS = [
  { token: "{saudacao}", desc: "saudação inicial" },
  { token: "{itens}", desc: "lista de itens da sacola" },
  { token: "{total}", desc: "valor total do pedido" },
  { token: "{pagamento}", desc: "forma de pagamento escolhida" },
  { token: "{entrega}", desc: "forma de entrega escolhida" },
];

type State = { error: string } | { ok: true } | null;

export function useConfiguracoes(settings: StoreSettings) {
  const [storeName, setStoreName] = useState(settings.name);
  const loja = useLojaFields({
    whatsapp: settings.whatsapp,
    monogram: settings.monogram,
    storeDescription: settings.description,
    instagram: settings.instagram,
    paymentMethods: settings.paymentMethods,
    deliveryMethods: settings.deliveryMethods,
  });
  const [msgTpl, setMsgTpl] = useState(settings.messageTemplate ?? MSG_DEFAULT);
  const [toast, setToast] = useState<ToastState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("messageTemplate", msgTpl);
      formData.set("instagram", loja.instagram);
      formData.set("paymentMethods", JSON.stringify(loja.paymentMethods));
      formData.set("deliveryMethods", JSON.stringify(loja.deliveryMethods));
      if (loja.logo) formData.set("logo", loja.logo);
      const res = await updateStoreSettings(prev, formData);
      if (res && "ok" in res) flash("Configurações salvas");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : msgTpl.length;
    const end = el ? el.selectionEnd : msgTpl.length;
    const next = msgTpl.slice(0, start) + token + msgTpl.slice(end);
    setMsgTpl(next);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const resetTemplate = () => {
    setMsgTpl(MSG_DEFAULT);
    flash("Mensagem restaurada");
  };

  return {
    settings,
    storeName,
    setStoreName,
    ...loja,
    msgTpl,
    setMsgTpl,
    state,
    formAction,
    pending,
    toast,
    textareaRef,
    insertToken,
    resetTemplate,
  };
}
