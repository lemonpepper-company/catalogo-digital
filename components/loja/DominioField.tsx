"use client";

import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface DominioFieldProps {
  domain: string;
  onDomainChange: (value: string) => void;
  verified: boolean;
  hasDomain: boolean;
  unlocked: boolean;
  pending: boolean;
}

export function DominioField({
  domain,
  onDomainChange,
  verified,
  hasDomain,
  unlocked,
  pending,
}: DominioFieldProps) {
  if (!unlocked) {
    return (
      <p className="font-body text-[13px] text-graphite">
        Domínio próprio disponível no plano Pro.{" "}
        <Link href="/painel/assinatura" className="underline">
          Fazer upgrade
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        name="customDomain"
        label="Domínio"
        placeholder="minhaloja.com.br"
        value={domain}
        onChange={(e) => onDomainChange(e.target.value)}
      />
      {hasDomain && (
        <span
          className={
            verified
              ? "inline-flex w-fit items-center h-6 px-2.5 rounded-pill bg-[#e6f4ee] text-[#1a9c6e] font-body text-[12px]"
              : "inline-flex w-fit items-center h-6 px-2.5 rounded-pill bg-linen text-graphite font-body text-[12px]"
          }
        >
          {verified ? "Verificado" : "Aguardando verificação"}
        </span>
      )}
      <p className="font-body text-[13px] text-graphite">
        Aponte um registro CNAME do seu domínio para nós e avise pelo WhatsApp — a
        ativação é feita manualmente após a verificação do DNS.
      </p>
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="self-start">
        {pending ? "Salvando…" : "Salvar domínio"}
      </Button>
    </div>
  );
}
