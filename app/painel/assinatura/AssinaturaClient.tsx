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
  salvarEndereco,
  type AssinaturaState,
  type MeioPagamento,
} from "@/app/actions/assinatura";
import { buscarEndereco } from "@/app/actions/cep";
import { validarCep } from "@/lib/validation/cep";
import { PRECOS, type PaidPlan } from "@/lib/asaas/plans";
import type { BillingCycle, SubscriptionStatus } from "@/lib/asaas/events";
import { PLAN_RANK, type Plan } from "@/lib/plan-limits";
import { formatarDataSP } from "@/lib/timezone-sp";

type Status = SubscriptionStatus | null;

const PLAN_LABELS: Record<PaidPlan, string> = { starter: "Starter", pro: "Pro" };
const CYCLE_LABELS: Record<BillingCycle, string> = { monthly: "Mensal", annual: "Anual" };

/**
 * Escolhe a frase de status a partir de `subscriptionStatus` + `planExpiresAt`.
 * Sem os dois, o lojista nunca teve (ou não tem mais) assinatura paga em curso.
 * Plano e ciclo entram no início da frase — sem eles, nada na tela dizia qual
 * plano o lojista tem quando `status === "canceled"` (o botão "Plano atual"
 * só aparece com `status === "active"`).
 */
export function mensagemDeStatus(
  status: Status,
  planExpiresAt: string | null,
  plan: Plan,
  billingCycle: BillingCycle | null
): string {
  if (!status || !planExpiresAt) return "Você está no plano Free.";
  const data = formatarDataSP(planExpiresAt);
  const rotuloPlano =
    plan !== "free" && billingCycle
      ? `${PLAN_LABELS[plan]} ${CYCLE_LABELS[billingCycle].toLowerCase()}`
      : null;

  switch (status) {
    case "active":
      return rotuloPlano ? `${rotuloPlano} — renova em ${data}.` : `Renova em ${data}.`;
    case "past_due":
      return rotuloPlano
        ? `${rotuloPlano} — cobrança falhou, regularize até ${data}.`
        : `Sua cobrança falhou — regularize até ${data}.`;
    case "canceled":
      return rotuloPlano ? `${rotuloPlano} — termina em ${data}.` : `Sua assinatura termina em ${data}.`;
  }
}
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

/** Fora do corpo do componente: `Date.now()` aqui não é uma chamada impura de render. */
function expiraNoFuturo(planExpiresAt: string | null): boolean {
  return !!planExpiresAt && new Date(planExpiresAt).getTime() > Date.now();
}

interface BotaoPlano {
  disabled: boolean;
  variant: "ghost" | "primary";
  label: string;
  title?: string;
}

/**
 * Decide o estado de cada botão de plano. Um bloqueio nunca é só `disabled`
 * — sempre tem `title` explicando por quê, ou vira chamado de suporte.
 * A ordem dos ifs é a ordem de prioridade dos motivos de bloqueio.
 */
function analisarBotaoPlano({
  p,
  cycle,
  plan,
  billingCycle,
  status,
  planExpiresAt,
  pending,
  meio,
  carregando,
}: {
  p: PaidPlan;
  cycle: BillingCycle;
  plan: Plan;
  billingCycle: BillingCycle | null;
  status: Status;
  planExpiresAt: string | null;
  pending: PaidPlan | null;
  meio: MeioPagamento | null;
  carregando: boolean;
}): BotaoPlano {
  const ehAtual = plan === p && billingCycle === cycle && status === "active";
  if (ehAtual) return { disabled: true, variant: "ghost", label: "Plano atual" };

  // Cancelar mantém acesso até plan_expires_at — sem assinatura viva no
  // Asaas, o caminho vira assinar de novo (iniciarAssinatura), não trocar.
  const semAssinaturaViva = plan === "free" || status === "canceled";

  // Ainda dentro do período pago de uma assinatura já cancelada: assinar o
  // mesmo plano ou um menor cobraria duas vezes o mesmo intervalo. Só o
  // upgrade fica liberado, porque ele não duplica valor, aumenta.
  const emPeriodoPagoCancelado = status === "canceled" && expiraNoFuturo(planExpiresAt);
  if (emPeriodoPagoCancelado && PLAN_RANK[p] <= PLAN_RANK[plan]) {
    const data = formatarDataSP(planExpiresAt!);
    if (p === plan) {
      return {
        disabled: true,
        variant: "ghost",
        label: "Aguarde a renovação",
        title: `Você já tem ${PLAN_LABELS[p]} até ${data}. Poderá renovar a partir dessa data.`,
      };
    }
    return {
      disabled: true,
      variant: "ghost",
      label: "Aguarde o fim do período",
      title: `Para mudar para um plano menor, aguarde o fim do período atual em ${data}.`,
    };
  }

  // Decisão de produto: Pro não troca para Starter — quem quiser reduzir
  // cancela e assina o menor depois.
  if (plan === "pro" && p === "starter" && !semAssinaturaViva) {
    return {
      disabled: true,
      variant: "ghost",
      label: "Cancele para reduzir o plano",
      title: "Para mudar para um plano menor, cancele a assinatura atual.",
    };
  }

  // trocarPlano(destino, meio) não recebe ciclo — o servidor reusa
  // store.billingCycle. Sem essa trava, Starter anual → Pro mensal pagaria a
  // diferença calculada sobre preços anuais e terminaria em Pro anual, sem
  // aviso nenhum. Vale para qualquer plano, não só o mesmo.
  const cicloDiferente = !semAssinaturaViva && billingCycle !== null && billingCycle !== cycle;
  if (cicloDiferente) {
    return {
      disabled: true,
      variant: "ghost",
      label: "Cancele para trocar o ciclo",
      title: `Sua assinatura é ${CYCLE_LABELS[billingCycle as BillingCycle].toLowerCase()}. Para mudar para cobrança ${CYCLE_LABELS[cycle].toLowerCase()}, cancele e assine novamente ao fim do período.`,
    };
  }

  // Já existe uma troca aguardando confirmação do webhook (pending_plan) —
  // clicar de novo criaria uma segunda cobrança avulsa em cima da que já
  // está pendente.
  if (!!pending && p !== plan) {
    return {
      disabled: true,
      variant: "ghost",
      label: "Troca já em andamento",
      title: "Já existe uma troca de plano aguardando confirmação do pagamento.",
    };
  }

  const precoTxt = `Assinar ${PLAN_LABELS[p]} ${CYCLE_LABELS[cycle]} — ${precoLabel(p, cycle)}`;

  // Botões de plano ficam desabilitados até um meio ser escolhido — o
  // lojista precisa decidir explicitamente, sem cair num padrão que ele
  // talvez nem perceba que havia.
  if (!meio) {
    return {
      disabled: true,
      variant: "primary",
      label: precoTxt,
      title: "Escolha um meio de pagamento primeiro.",
    };
  }

  return { disabled: carregando, variant: "primary", label: carregando ? "Assinando…" : precoTxt };
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
  /** Cobrança Pix em aberto buscada no servidor — sobrevive a navegação/refresh, ao contrário de pixUrl. */
  pixPendente?: { invoiceUrl: string; dueDate: string } | null;
}

export function AssinaturaClient({
  plan,
  planExpiresAt,
  subscriptionStatus,
  billingCycle,
  pendingPlan,
  document,
  pixPendente,
}: AssinaturaClientProps) {
  const [status, setStatus] = useState<Status>(subscriptionStatus);
  const [pending, setPending] = useState<PaidPlan | null>(pendingPlan);
  // Sem valor padrão de propósito: o lojista precisa escolher explicitamente
  // antes de ver os planos habilitados, ou corre o risco de assinar pelo
  // meio errado sem perceber que havia uma escolha ali. Vale tanto pra
  // primeira assinatura quanto pra upgrade — trocarPlano usa o meio
  // escolhido aqui pra cobrar a diferença proporcional.
  const [meio, setMeio] = useState<MeioPagamento | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pixUrl, setPixUrl] = useState<string | null>(null);

  const [documentIntencao, setDocumentIntencao] = useState<Intencao | null>(null);
  const [documentValue, setDocumentValue] = useState("");
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [savingDocument, setSavingDocument] = useState(false);

  const [enderecoIntencao, setEnderecoIntencao] = useState<Intencao | null>(null);
  const [cepValue, setCepValue] = useState("");
  const [numeroValue, setNumeroValue] = useState("");
  const [ruaValue, setRuaValue] = useState("");
  const [bairroValue, setBairroValue] = useState("");
  const [cidadeValue, setCidadeValue] = useState("");
  const [enderecoError, setEnderecoError] = useState<string | null>(null);
  const [savingEndereco, setSavingEndereco] = useState(false);

  // Sugere rua/bairro/cidade a partir do CEP ao sair do campo — nem todo
  // CEP tem os três dados no ViaCEP, então só preenche o que veio e nunca
  // sobrescreve o que o lojista já tiver digitado manualmente.
  async function autopreencherPorCep() {
    if (!validarCep(cepValue)) return;
    const encontrado = await buscarEndereco(cepValue);
    if (!encontrado) return;
    setRuaValue((atual) => atual || encontrado.logradouro);
    setBairroValue((atual) => atual || encontrado.bairro);
    setCidadeValue((atual) => atual || encontrado.cidade);
  }

  const podeCancelar = status === "active" || status === "past_due";
  // Cancelar deleta a assinatura no Asaas mas mantém o acesso até
  // plan_expires_at (é assim que já funciona: cancelamento só RESTRINGE,
  // nunca corta o que já foi pago). Isso significa que "plan" continua não
  // sendo "free" por um tempo mesmo sem nenhuma assinatura viva pra
  // trocarPlano atualizar — sem esse caso, o clique caía em trocarPlano
  // tentando mexer numa assinatura que não existe mais no Asaas e quebrava.
  const semAssinaturaViva = plan === "free" || status === "canceled";

  // Starter cancelado ainda dentro do período pago: só o upgrade pro Pro
  // fica liberado (não há plano acima de Pro). Ao confirmar, plan_expires_at
  // é recalculado a partir da nova cobrança e o restante do Starter é
  // absorvido — vale avisar aqui pra não parecer erro quando a data mudar.
  const upgradeDisponivelAposCancelamento =
    plan === "starter" && status === "canceled" && expiraNoFuturo(planExpiresAt);

  function tratarResultado(result: AssinaturaState, intencao: Intencao) {
    if (!result) return;

    if ("error" in result) {
      // DOCUMENTO_NECESSARIO e ENDERECO_NECESSARIO são códigos de controle —
      // nunca viram texto na tela.
      if (result.error === "DOCUMENTO_NECESSARIO") {
        setDocumentIntencao(intencao);
        // A loja já pode ter um documento salvo (ex: dado ficou defasado
        // entre o carregamento da página e o clique) — pré-popula em vez de
        // pedir para redigitar do zero.
        setDocumentValue(document ?? "");
        return;
      }
      if (result.error === "ENDERECO_NECESSARIO") {
        setEnderecoIntencao(intencao);
        setCepValue("");
        setNumeroValue("");
        setRuaValue("");
        setBairroValue("");
        setCidadeValue("");
        return;
      }
      setErrorMsg(result.error);
      return;
    }

    if (result.redirectUrl) {
      window.location.href = result.redirectUrl;
      return;
    }

    if (result.pixUrl) {
      // Ao contrário do cartão, o Pix não sai do site — a cobrança já foi
      // criada no Asaas, mas sem esse link o lojista não tem como pagar (o
      // Asaas não avisa nada sozinho na nossa tela).
      setPixUrl(result.pixUrl);
      return;
    }

    setToastMsg("Assinatura em processamento. Avisamos assim que o pagamento confirmar.");
  }

  async function assinar(destino: PaidPlan, cycle: BillingCycle) {
    // Botões de plano ficam desabilitados até um meio ser escolhido — este
    // guard é só defensivo (nunca deveria disparar via UI).
    if (!meio) return;
    setErrorMsg(null);
    const key = `${destino}-${cycle}`;
    setLoadingKey(key);
    try {
      const intencao: Intencao = { plan: destino, cycle, meio };
      const result = semAssinaturaViva
        ? await iniciarAssinatura(destino, cycle, meio)
        : await trocarPlano(destino, meio);

      if (result && "ok" in result && !semAssinaturaViva) {
        // trocarPlano grava pending_plan tanto no upgrade quanto no downgrade
        // (a promoção em si só acontece no webhook, quando a cobrança
        // confirmar) — refletir aqui é verdade nos dois casos.
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

  async function confirmarEndereco() {
    if (!enderecoIntencao) return;
    setEnderecoError(null);
    setSavingEndereco(true);
    try {
      const result = await salvarEndereco(cepValue, numeroValue, ruaValue, bairroValue, cidadeValue);
      if (result && "error" in result) {
        setEnderecoError(result.error);
        return;
      }

      const intencao = enderecoIntencao;
      setEnderecoIntencao(null);
      setCepValue("");
      setNumeroValue("");
      setRuaValue("");
      setBairroValue("");
      setCidadeValue("");

      const key = `${intencao.plan}-${intencao.cycle}`;
      setLoadingKey(key);
      try {
        const retry = await iniciarAssinatura(intencao.plan, intencao.cycle, intencao.meio);
        tratarResultado(retry, intencao);
      } finally {
        setLoadingKey(null);
      }
    } finally {
      setSavingEndereco(false);
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
      setPending(null);
      setToastMsg("Assinatura cancelada. O acesso continua até o fim do período pago.");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <h1 className="font-display font-semibold text-[28px] text-obsidian">Assinatura</h1>

      <Card>
        <p className="font-body text-[15px] text-obsidian">
          {mensagemDeStatus(status, planExpiresAt, plan, billingCycle)}
        </p>
        {pending && (
          <p className="font-body text-[13px] text-graphite mt-2">
            {planExpiresAt
              ? // Downgrade de uma assinatura já ativa: pending_plan muda o
                // plano na renovação, data conhecida.
                `Muda para ${PLAN_LABELS[pending]} em ${formatarDataSP(planExpiresAt)}.`
              : // Primeira assinatura (Free → pago): pending_plan já foi
                // gravado, mas plan_expires_at só existe depois do webhook
                // confirmar o primeiro pagamento — sem data ainda.
                `Assinatura em processamento — muda para ${PLAN_LABELS[pending]} assim que o pagamento confirmar.`}
          </p>
        )}
      </Card>

      {/*
        pixUrl vem do clique de assinar (só existe nesta sessão do navegador,
        some ao recarregar); pixPendente vem do servidor, buscado no Asaas a
        cada carregamento da página — sem ele, a cobrança do segundo ciclo em
        diante (renovação, não o clique inicial) nunca reaparecia na tela,
        mesmo com uma cobrança de verdade esperando pagamento no Asaas.
      */}
      {(pixUrl ?? pixPendente) && (
        <Card className="border-gold/40 bg-linen">
          <h2 className="font-display font-medium text-[16px] text-obsidian mb-2">
            Falta pagar
          </h2>
          <p className="font-body text-[13px] text-graphite mb-4">
            {pixUrl
              ? "Criamos sua cobrança Pix. Abra o link abaixo para ver o QR code e o código copia-e-cola — o acesso libera assim que o pagamento confirmar."
              : `Você tem uma cobrança Pix em aberto, vencimento em ${formatarDataSP(pixPendente!.dueDate)}. Abra o link abaixo para ver o QR code e o código copia-e-cola.`}
          </p>
          <a
            href={pixUrl ?? pixPendente!.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-btn border font-display font-medium h-11 px-6 text-[15px] bg-obsidian text-white border-obsidian hover:bg-[#1f1f1f] transition-all duration-200 ease"
          >
            Pagar agora →
          </a>
        </Card>
      )}

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          1. Meio de pagamento
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

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">2. Escolha o plano</h2>
        {!meio && (
          <p className="font-body text-[13px] text-graphite mb-3">
            Escolha um meio de pagamento acima para continuar.
          </p>
        )}
        {upgradeDisponivelAposCancelamento && (
          <p className="font-body text-[13px] text-graphite mb-3">
            Você tem Starter até {formatarDataSP(planExpiresAt!)}. Ao assinar o Pro agora, a data de
            renovação é recalculada e o restante do período atual é aproveitado.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
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
                const botao = analisarBotaoPlano({
                  p,
                  cycle,
                  plan,
                  billingCycle,
                  status,
                  planExpiresAt,
                  pending,
                  meio,
                  carregando: loadingKey === key,
                });
                return (
                  <Button
                    key={key}
                    type="button"
                    variant={botao.variant}
                    size="sm"
                    className="min-h-9 py-2 text-center leading-snug"
                    style={{ height: "auto", whiteSpace: "normal" }}
                    disabled={botao.disabled}
                    title={botao.title}
                    onClick={() => assinar(p, cycle)}
                  >
                    {botao.label}
                  </Button>
                );
              })}
            </div>
          ))}
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
            O Asaas exige CPF ou CNPJ para processar a assinatura.
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

      {enderecoIntencao && (
        <Modal title="Confirme seu endereço" onClose={() => setEnderecoIntencao(null)}>
          <p className="font-body text-[13px] text-graphite">
            O Asaas exige um endereço para o checkout de cartão. Rua, bairro e
            cidade são sugeridos pelo CEP quando possível — confira ou
            complete manualmente.
          </p>
          <Input
            label="CEP"
            value={cepValue}
            onChange={(e) => setCepValue(e.target.value)}
            onBlur={autopreencherPorCep}
            error={enderecoError ?? undefined}
          />
          <Input
            label="Número"
            value={numeroValue}
            onChange={(e) => setNumeroValue(e.target.value)}
          />
          <Input
            label="Rua"
            value={ruaValue}
            onChange={(e) => setRuaValue(e.target.value)}
          />
          <Input
            label="Bairro"
            value={bairroValue}
            onChange={(e) => setBairroValue(e.target.value)}
          />
          <Input
            label="Cidade"
            value={cidadeValue}
            onChange={(e) => setCidadeValue(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setEnderecoIntencao(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={savingEndereco}
              onClick={confirmarEndereco}
            >
              {savingEndereco ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
