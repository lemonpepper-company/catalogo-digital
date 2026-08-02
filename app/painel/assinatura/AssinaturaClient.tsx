"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import {
  iniciarAssinatura,
  trocarPlano,
  cancelarAssinatura,
  salvarDocumento,
  type AssinaturaState,
  type MeioPagamento,
} from "@/app/actions/assinatura";
import { PRECOS, type PaidPlan } from "@/lib/asaas/plans";
import type { BillingCycle, SubscriptionStatus } from "@/lib/asaas/events";
import type { Plan } from "@/lib/plan-limits";
import { formatarDataSP } from "@/lib/timezone-sp";

type Status = SubscriptionStatus | null;

/**
 * Escolhe a frase de status a partir de `subscriptionStatus` + `planExpiresAt`.
 * Sem os dois, o lojista nunca teve (ou não tem mais) assinatura paga em curso.
 */
export function mensagemDeStatus(status: Status, planExpiresAt: string | null): string {
  if (!status || !planExpiresAt) return "Você está no plano Free.";
  const data = formatarDataSP(planExpiresAt);

  switch (status) {
    case "active":
      return `Renova em ${data}.`;
    case "past_due":
      return `Sua cobrança falhou — regularize até ${data}.`;
    case "canceled":
      return `Sua assinatura termina em ${data}.`;
  }
}

const PLAN_LABELS: Record<PaidPlan, string> = { starter: "Starter", pro: "Pro" };
const CYCLE_LABELS: Record<BillingCycle, string> = { monthly: "Mensal", annual: "Anual" };
const PLANOS: PaidPlan[] = ["starter", "pro"];
const CICLOS: BillingCycle[] = ["monthly", "annual"];

function formatBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function precoLabel(plan: PaidPlan, cycle: BillingCycle): string {
  const preco = PRECOS[plan][cycle];
  if (cycle === "monthly") return formatBRL(preco);
  return `${formatBRL(preco / 12)}/mês, cobrado anualmente`;
}

interface Intencao {
  plan: PaidPlan;
  cycle: BillingCycle;
  meio: MeioPagamento;
}

interface AssinaturaClientProps {
  plan: Plan;
  planExpiresAt: string | null;
  subscriptionStatus: Status;
  billingCycle: BillingCycle | null;
  pendingPlan: PaidPlan | null;
  document?: string | null;
}

export function AssinaturaClient({
  plan,
  planExpiresAt,
  subscriptionStatus,
  billingCycle,
  pendingPlan,
}: AssinaturaClientProps) {
  const [status, setStatus] = useState<Status>(subscriptionStatus);
  const [pending, setPending] = useState<PaidPlan | null>(pendingPlan);
  const [meio, setMeio] = useState<MeioPagamento>("PIX");
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [documentIntencao, setDocumentIntencao] = useState<Intencao | null>(null);
  const [documentValue, setDocumentValue] = useState("");
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [savingDocument, setSavingDocument] = useState(false);

  const podeCancelar = status === "active" || status === "past_due";

  function tratarResultado(result: AssinaturaState, intencao: Intencao) {
    if (!result) return;

    if ("error" in result) {
      // DOCUMENTO_NECESSARIO é um código de controle — nunca vira texto na tela.
      if (result.error === "DOCUMENTO_NECESSARIO") {
        setDocumentIntencao(intencao);
        return;
      }
      setErrorMsg(result.error);
      return;
    }

    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }

    setToastMsg("Assinatura em processamento. Avisamos assim que o pagamento confirmar.");
  }

  async function assinar(destino: PaidPlan, cycle: BillingCycle) {
    setErrorMsg(null);
    const key = `${destino}-${cycle}`;
    setLoadingKey(key);
    try {
      const intencao: Intencao = { plan: destino, cycle, meio };
      const result =
        plan === "free" ? await iniciarAssinatura(destino, cycle, meio) : await trocarPlano(destino);

      if (result && "ok" in result && plan !== "free") {
        // trocarPlano: downgrade agenda pending_plan; upgrade cobra diferença
        // avulsa e só promove no webhook — aqui só refletimos o downgrade.
        setPending(destino);
      }

      tratarResultado(result, intencao);
    } finally {
      setLoadingKey(null);
    }
  }

  async function confirmarDocumento() {
    if (!documentIntencao) return;
    setDocumentError(null);
    setSavingDocument(true);
    try {
      const result = await salvarDocumento(documentValue);
      if (result && "error" in result) {
        setDocumentError(result.error);
        return;
      }

      const intencao = documentIntencao;
      setDocumentIntencao(null);
      setDocumentValue("");

      const key = `${intencao.plan}-${intencao.cycle}`;
      setLoadingKey(key);
      try {
        const retry = await iniciarAssinatura(intencao.plan, intencao.cycle, intencao.meio);
        tratarResultado(retry, intencao);
      } finally {
        setLoadingKey(null);
      }
    } finally {
      setSavingDocument(false);
    }
  }

  async function cancelar() {
    setErrorMsg(null);
    setLoadingKey("cancelar");
    try {
      const result = await cancelarAssinatura();
      if (result && "error" in result) {
        setErrorMsg(result.error);
        return;
      }
      setStatus("canceled");
      setToastMsg("Assinatura cancelada. O acesso continua até o fim do período pago.");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <h1 className="font-display font-semibold text-[28px] text-obsidian">Assinatura</h1>

      <Card>
        <p className="font-body text-[15px] text-obsidian">{mensagemDeStatus(status, planExpiresAt)}</p>
        {pending && (
          <p className="font-body text-[13px] text-graphite mt-2">
            Muda para {PLAN_LABELS[pending]} em {planExpiresAt ? formatarDataSP(planExpiresAt) : ""}.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">Planos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLANOS.map((p) => (
            <div
              key={p}
              className="flex flex-col gap-2 p-4 rounded-card border border-sand/50 bg-linen"
            >
              <span className="font-display font-medium text-[15px] text-obsidian">
                {PLAN_LABELS[p]}
              </span>
              {CICLOS.map((cycle) => {
                const key = `${p}-${cycle}`;
                const ehAtual = plan === p && billingCycle === cycle && status === "active";
                const carregando = loadingKey === key;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant={ehAtual ? "ghost" : "primary"}
                    size="sm"
                    disabled={ehAtual || carregando}
                    onClick={() => assinar(p, cycle)}
                  >
                    {ehAtual
                      ? "Plano atual"
                      : carregando
                        ? "Assinando…"
                        : `Assinar ${PLAN_LABELS[p]} ${CYCLE_LABELS[cycle]} — ${precoLabel(p, cycle)}`}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Meio de pagamento
        </h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="meio"
              value="CREDIT_CARD"
              checked={meio === "CREDIT_CARD"}
              onChange={() => setMeio("CREDIT_CARD")}
              className="mt-1"
            />
            <span>
              <span className="block font-body font-medium text-[14px] text-obsidian">
                Cartão
              </span>
              <span className="block font-body text-[12px] text-graphite">
                Você será redirecionado para o Asaas.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="meio"
              value="PIX"
              checked={meio === "PIX"}
              onChange={() => setMeio("PIX")}
              className="mt-1"
            />
            <span>
              <span className="block font-body font-medium text-[14px] text-obsidian">Pix</span>
              <span className="block font-body text-[12px] text-graphite">
                Geramos uma cobrança a cada ciclo.
              </span>
            </span>
          </label>
        </div>
      </Card>

      {errorMsg && (
        <p role="alert" className="font-body text-[13px] text-error">
          {errorMsg}
        </p>
      )}

      {podeCancelar && (
        <div className="flex justify-end pb-6">
          <Button
            type="button"
            variant="destructive"
            disabled={loadingKey === "cancelar"}
            onClick={cancelar}
          >
            {loadingKey === "cancelar" ? "Cancelando…" : "Cancelar assinatura"}
          </Button>
        </div>
      )}

      {toastMsg && <Toast msg={toastMsg} tone="success" />}

      {documentIntencao && (
        <Modal title="Confirme seu documento" onClose={() => setDocumentIntencao(null)}>
          <p className="font-body text-[13px] text-graphite">
            O Asaas exige CPF ou CNPJ para emitir cobranças Pix.
          </p>
          <Input
            label="CPF ou CNPJ"
            value={documentValue}
            onChange={(e) => setDocumentValue(e.target.value)}
            error={documentError ?? undefined}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setDocumentIntencao(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={savingDocument}
              onClick={confirmarDocumento}
            >
              {savingDocument ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
