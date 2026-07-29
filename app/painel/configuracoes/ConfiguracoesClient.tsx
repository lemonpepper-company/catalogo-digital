"use client";

import { ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { IdentidadeFields } from "@/components/loja/IdentidadeFields";
import { PagamentoEntregaFields } from "@/components/loja/PagamentoEntregaFields";
import { DominioField } from "@/components/loja/DominioField";
import { signOut } from "@/app/actions/auth";
import { vtrineWhatsAppHref, SUPPORT_WHATSAPP_MESSAGE } from "@/lib/contact";
import type { StoreSettings } from "@/lib/types";
import type { PlanLimits } from "@/lib/plan-limits";
import { useConfiguracoes, MSG_VARS } from "./use-configuracoes";
import { useDominio } from "./use-dominio";
import { formatPaymentLine, formatDeliveryLine, collapseBlankLines } from "@/lib/utils";

const MSG_MOCK = {
  saudacao: "Olá! Gostaria de fazer um pedido:",
  nome: "Cliente: Ana",
  pedido: "Pedido: A1B2C3",
  itens:
    "01. Produto Exemplo\n    Quantidade: 2x | Valor unitário: R$ 50,00\n    Tamanho: M\n    Cor: Preto\n    Subtotal: R$ 100,00",
  total: "R$ 100,00",
};

function renderTemplate(
  tpl: string,
  paymentMethods: string[],
  deliveryMethods: string[]
) {
  const pagamento = formatPaymentLine(paymentMethods[0] ?? null);
  const entrega = formatDeliveryLine(deliveryMethods[0] ?? null, null);
  const rendered = tpl
    .replace(/\{saudacao\}/g, MSG_MOCK.saudacao)
    .replace(/\{nome\}/g, MSG_MOCK.nome)
    .replace(/\{pedido\}/g, MSG_MOCK.pedido)
    .replace(/\{itens\}/g, MSG_MOCK.itens)
    .replace(/\{total\}/g, MSG_MOCK.total)
    .replace(/\{pagamento\}/g, pagamento)
    .replace(/\{entrega\}/g, entrega);
  return collapseBlankLines(rendered);
}

function WhatsPreviewText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((seg, i) =>
        seg.startsWith("*") && seg.endsWith("*") && seg.length > 1 ? (
          <strong key={i} style={{ fontWeight: 700, color: "var(--color-text-1)" }}>
            {seg.slice(1, -1)}
          </strong>
        ) : (
          <span key={i}>{seg}</span>
        )
      )}
    </>
  );
}

export function ConfiguracoesClient({
  settings,
  limits,
}: {
  settings: StoreSettings;
  limits: PlanLimits;
}) {
  const f = useConfiguracoes(settings);
  const dominio = useDominio(settings);
  const catalogUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${settings.slug}`;
  const catalogLabel = catalogUrl.replace(/^https?:\/\//, "");

  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <Card className="lg:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Catálogo público
            </div>
            <a
              href={catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display font-medium text-[15px] text-obsidian flex items-center gap-1.5 hover:underline mt-1 min-w-0"
            >
              <span className="truncate">{catalogLabel}</span>
              <ExternalLink size={13} className="flex-shrink-0" />
            </a>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" iconLeft={<LogOut size={18} />}>
              Sair
            </Button>
          </form>
        </div>
      </Card>

      <form action={f.formAction} className="flex flex-col gap-5">
        <h1 className="font-display font-semibold text-[28px] text-obsidian">
          Configurações da loja
        </h1>

        <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Identidade
        </h2>
        <IdentidadeFields
          nameForInitials={f.storeName}
          logoUrl={settings.logoUrl}
          logoPreview={f.logoPreview}
          logoFileName={f.logo?.name}
          onLogoChange={f.setLogo}
          whatsapp={f.whatsapp}
          onWhatsappChange={f.setWhatsapp}
          monogram={f.monogram}
          onMonogramChange={f.setMonogram}
          instagram={f.instagram}
          onInstagramChange={f.setInstagram}
          storeDescription={f.storeDescription}
          onStoreDescriptionChange={f.setStoreDescription}
        >
          <div className="mb-[18px]">
            <Input
              name="name"
              label="Nome da loja"
              value={f.storeName}
              onChange={(e) => f.setStoreName(e.target.value)}
            />
          </div>
        </IdentidadeFields>
      </Card>

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Mensagem do pedido{" "}
          <span className="text-graphite font-normal">
            · enviada no WhatsApp ao finalizar a sacola
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-3">
            <textarea
              ref={f.textareaRef}
              value={f.msgTpl}
              onChange={(e) => f.setMsgTpl(e.target.value)}
              rows={11}
              className="w-full px-3.5 py-3 bg-white border border-sand rounded-input font-mono text-[13px] leading-relaxed text-obsidian outline-none focus:border-obsidian resize-y"
            />
            <div className="flex flex-wrap gap-2">
              {MSG_VARS.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => f.insertToken(v.token)}
                  title={`Inserir ${v.desc}`}
                  className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-pill border border-sand bg-linen font-mono text-[12.5px] text-obsidian hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <span className="text-gold">+</span>
                  {v.token}
                </button>
              ))}
            </div>
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={f.resetTemplate}>
                Restaurar padrão
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Pré-visualização
            </span>
            <div className="bg-linen border border-sand/50 rounded-card p-4 font-mono text-[12.5px] leading-relaxed text-graphite whitespace-pre-wrap break-words">
              <WhatsPreviewText
                text={renderTemplate(f.msgTpl, f.paymentMethods, f.deliveryMethods)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
          Pagamento e entrega
        </h2>
        <p className="font-body text-[13px] text-graphite mb-4">
          O cliente só vê essas opções no checkout se você marcar ao menos uma aqui.
        </p>
        <PagamentoEntregaFields
          paymentMethods={f.paymentMethods}
          onTogglePaymentMethod={f.togglePaymentMethod}
          deliveryMethods={f.deliveryMethods}
          onToggleDeliveryMethod={f.toggleDeliveryMethod}
        />
      </Card>

      {/* Integrações (Google Analytics + Facebook Pixel) — temporariamente ocultas da UI.
          Os campos analytics_id e pixel_id continuam existindo no banco e sendo preservados.
          Reativar quando a feature de injeção de scripts estiver pronta. */}

      <div className="flex justify-end gap-3 pb-6">
        <Button type="button" variant="ghost" onClick={() => history.back()}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={f.pending}>
          {f.pending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>

        {f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}
      </form>

      <form action={dominio.formAction}>
        <Card>
          <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
            Domínio próprio
          </h2>
          <p className="font-body text-[13px] text-graphite mb-4">
            Acesse sua vitrine pelo seu próprio domínio em vez de {catalogLabel}.
          </p>
          <DominioField
            domain={dominio.domain}
            onDomainChange={dominio.setDomain}
            verified={settings.customDomainVerified}
            hasDomain={!!settings.customDomain}
            unlocked={limits.customDomain}
            pending={dominio.pending}
          />
          {dominio.toast && <Toast msg={dominio.toast.msg} tone={dominio.toast.tone} />}
        </Card>
      </form>

      <div className="pb-6 flex justify-center">
        <a
          href={vtrineWhatsAppHref(SUPPORT_WHATSAPP_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[13px] text-graphite underline"
        >
          Precisa de ajuda? Fale com o suporte
        </a>
      </div>
    </div>
  );
}
