"use client";

import { useActionState, useRef, useState } from "react";
import { updatePersonalizacao } from "@/app/actions/store";
import { compressImage } from "@/lib/image-compress";
import type { StoreSettings, ToastState } from "@/lib/types";
import {
  DEFAULT_FONT_PAIRING_KEY,
  DEFAULT_BACKGROUND_PALETTE_KEY,
  DEFAULT_CORNER_STYLE_KEY,
} from "@/lib/theme-options";
import type { PlanLimits } from "@/lib/plan-limits";

type State = { error: string } | { ok: true } | null;

export function usePersonalizacao(settings: StoreSettings, limits: PlanLimits) {
  const [accent, setAccent] = useState(settings.accentColor);
  const [fontPairing, setFontPairing] = useState(
    limits.themeOptions ? settings.fontPairing : DEFAULT_FONT_PAIRING_KEY
  );
  const [backgroundPalette, setBackgroundPalette] = useState(
    limits.themeOptions ? settings.backgroundPalette : DEFAULT_BACKGROUND_PALETTE_KEY
  );
  const [cornerStyle, setCornerStyle] = useState(
    limits.themeOptions ? settings.cornerStyle : DEFAULT_CORNER_STYLE_KEY
  );
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [gridDensity, setGridDensity] = useState(
    limits.gridDensity ? settings.gridDensity : "padrao"
  );
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
      formData.set("fontPairing", fontPairing);
      formData.set("backgroundPalette", backgroundPalette);
      formData.set("cornerStyle", cornerStyle);
      formData.set("gridDensity", gridDensity);
      if (secondaryColor) formData.set("secondaryColor", secondaryColor);
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
    fontPairing,
    setFontPairing,
    backgroundPalette,
    setBackgroundPalette,
    cornerStyle,
    setCornerStyle,
    secondaryColor,
    setSecondaryColor,
    gridDensity,
    setGridDensity,
    limits,
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
