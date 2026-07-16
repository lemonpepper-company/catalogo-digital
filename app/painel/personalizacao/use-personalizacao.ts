"use client";

import { useActionState, useRef, useState } from "react";
import { updatePersonalizacao } from "@/app/actions/store";
import { compressImage } from "@/lib/image-compress";
import type { StoreSettings, ToastState } from "@/lib/types";

type State = { error: string } | { ok: true } | null;

export function usePersonalizacao(settings: StoreSettings) {
  const [accent, setAccent] = useState(settings.accentColor);
  const [cover, setCoverState] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const coverOpToken = useRef(0);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const setCover = async (file: File | null) => {
    const token = ++coverOpToken.current;
    const compressed = file ? await compressImage(file) : null;
    const nextPreview = compressed ? URL.createObjectURL(compressed) : null;
    if (coverOpToken.current !== token) {
      // A newer setCover or a clearCover happened while compressing; discard this result.
      if (nextPreview) URL.revokeObjectURL(nextPreview);
      return;
    }
    setCoverState(compressed);
    setRemoveCover(false);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextPreview;
    });
  };

  const clearCover = () => {
    coverOpToken.current++;
    setCoverState(null);
    setRemoveCover(true);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("accentColor", accent);
      if (cover) formData.set("cover", cover);
      if (removeCover) formData.set("removeCover", "1");
      const res = await updatePersonalizacao(prev, formData);
      if (res && "ok" in res) {
        flash("Personalização salva");
        setCoverPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setCoverState(null);
        setRemoveCover(false);
      }
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  return {
    accent,
    setAccent,
    coverPreview,
    coverFileName: cover?.name ?? null,
    coverUrl: removeCover ? null : settings.coverUrl,
    setCover,
    clearCover,
    state,
    formAction,
    pending,
    toast,
  };
}
