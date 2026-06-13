"use client";

import { useState, useRef } from "react";
import { STORE } from "@/lib/data";
import type { ToastState } from "@/lib/types";

export const MSG_DEFAULT = `{saudacao}\n\n{itens}\n\n━━━━━━━━━━━━━━━━━\n*Total: {total}*\n━━━━━━━━━━━━━━━━━`;

export const MSG_VARS = [
  { token: "{saudacao}", desc: "saudação inicial" },
  { token: "{itens}", desc: "lista de itens da sacola" },
  { token: "{total}", desc: "valor total do pedido" },
];

export function useConfiguracoes() {
  const [accent, setAccent] = useState(STORE.accentColor);
  const [msgTpl, setMsgTpl] = useState(MSG_DEFAULT);
  const [toast, setToast] = useState<ToastState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    accent,
    setAccent,
    msgTpl,
    setMsgTpl,
    toast,
    textareaRef,
    flash,
    insertToken,
    resetTemplate,
  };
}
