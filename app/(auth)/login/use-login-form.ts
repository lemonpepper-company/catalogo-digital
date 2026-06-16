"use client";

import { useState } from "react";

export function useLoginForm() {
  const [showPw, setShowPw] = useState(false);
  const togglePw = () => setShowPw((v) => !v);
  return { showPw, togglePw };
}
