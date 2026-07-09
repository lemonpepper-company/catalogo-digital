"use client";

import { useEffect, useState } from "react";

export type CookieConsent = "accepted" | "rejected" | null;

const STORAGE_KEY = "cookie-consent";

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Leitura única do localStorage pra hidratar o estado após o mount — não dá pra
    // ler no initializer do useState porque o servidor não tem localStorage, e ler
    // ali no cliente antes da hidratação causaria mismatch com o HTML do servidor.
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "accepted" || stored === "rejected") setConsent(stored);
    setHydrated(true);
  }, []);

  const accept = () => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setConsent("accepted");
  };

  const reject = () => {
    window.localStorage.setItem(STORAGE_KEY, "rejected");
    setConsent("rejected");
  };

  return { consent, hydrated, accept, reject };
}
