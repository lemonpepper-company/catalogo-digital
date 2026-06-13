"use client";

import { useState } from "react";

export function useVariationEditor() {
  const [on, setOn] = useState(true);
  const [draft, setDraft] = useState("");
  return { on, setOn, draft, setDraft };
}
