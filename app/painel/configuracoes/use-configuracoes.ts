"use client";

import { useActionState, useState, useRef } from "react";
import { updateStoreSettings } from "@/app/actions/store";
import { compressImage } from "@/lib/image-compress";
import type { StoreSettings, ToastState } from "@/lib/types";

export const MSG_DEFAULT = `{saudacao}\n\n{itens}\n\n━━━━━━━━━━━━━━━━━\n*Total: {total}*\n━━━━━━━━━━━━━━━━━`;

export const MSG_VARS = [
  { token: "{saudacao}", desc: "saudação inicial" },
  { token: "{itens}", desc: "lista de itens da sacola" },
  { token: "{total}", desc: "valor total do pedido" },
];

type State = { error: string } | { ok: true } | null;

export function useConfiguracoes(settings: StoreSettings) {
  const [storeName, setStoreName] = useState(settings.name);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp ?? '');
  const [monogram, setMonogram] = useState(settings.monogram ?? '');
  const [storeDescription, setStoreDescription] = useState(settings.description ?? '');
  // analyticsId e pixelId removidos do estado local — UI temporariamente oculta
  const [accent, setAccent] = useState(settings.accentColor);
  const [msgTpl, setMsgTpl] = useState(settings.messageTemplate ?? MSG_DEFAULT);
  const [logo, setLogoState] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const setLogo = async (file: File | null) => {
    const compressed = file ? await compressImage(file) : null;
    setLogoState(compressed);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return compressed ? URL.createObjectURL(compressed) : null;
    });
  };
  const [toast, setToast] = useState<ToastState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("accentColor", accent);
      formData.set("messageTemplate", msgTpl);
      if (logo) formData.set("logo", logo);
      const res = await updateStoreSettings(prev, formData);
      if (res && "ok" in res) flash("Configurações salvas");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

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
    whatsapp,
    setWhatsapp,
    monogram,
    setMonogram,
    storeDescription,
    setStoreDescription,
    accent,
    setAccent,
    msgTpl,
    setMsgTpl,
    logo,
    logoPreview,
    setLogo,
    state,
    formAction,
    pending,
    toast,
    textareaRef,
    insertToken,
    resetTemplate,
  };
}
