"use client";

import { useState } from "react";
import { FASHION_COLORS } from "@/lib/data";

export function useColorSelector() {
  const [on, setOn] = useState(true);
  const [custom, setCustom] = useState("");
  const [pick, setPick] = useState("#7A8B6F");
  const [customHex, setCustomHex] = useState<Record<string, string>>({});

  const hexFor = (name: string): string =>
    FASHION_COLORS.find((fc) => fc.name.toLowerCase() === name.toLowerCase())?.hex ??
    customHex[name.toLowerCase()] ??
    "var(--color-surface-hover)";

  return { on, setOn, custom, setCustom, pick, setPick, customHex, setCustomHex, hexFor };
}
