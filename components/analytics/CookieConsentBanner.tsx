"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface CookieConsentBannerProps {
  onAccept: () => void;
  onReject: () => void;
}

export function CookieConsentBanner({ onAccept, onReject }: CookieConsentBannerProps) {
  return (
    <div
      role="region"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-sand bg-white px-4 py-4 sm:px-8"
    >
      <div className="mx-auto flex max-w-page flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-[13px] text-graphite">
          Usamos cookies para melhorar sua experiência e medir o uso do site. Veja nossa{" "}
          <Link href="/politica-de-privacidade" className="underline hover:text-obsidian">
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="flex flex-shrink-0 items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onReject}>
            Recusar
          </Button>
          <Button variant="primary" size="sm" onClick={onAccept}>
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
