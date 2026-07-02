"use client";

import { Upload, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { ACCENT_COLOR_OPTIONS } from "@/lib/data";
import { signOut } from "@/app/actions/auth";
import type { StoreSettings } from "@/lib/types";
import { useConfiguracoes, MSG_VARS } from "./use-configuracoes";

const MSG_MOCK = {
  saudacao: "Olá! Gostaria de fazer um pedido:",
  itens:
    "01. Produto Exemplo\n    Quantidade: 2x | Valor unitário: R$ 50,00\n    Tamanho: M\n    Cor: Preto\n    Subtotal: R$ 100,00",
  total: "R$ 100,00",
};

function renderTemplate(tpl: string) {
  return tpl
    .replace(/\{saudacao\}/g, MSG_MOCK.saudacao)
    .replace(/\{itens\}/g, MSG_MOCK.itens)
    .replace(/\{total\}/g, MSG_MOCK.total);
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

export function ConfiguracoesClient({ settings }: { settings: StoreSettings }) {
  const f = useConfiguracoes(settings);
  const catalogUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${settings.slug}`;
  const catalogLabel = catalogUrl.replace(/^https?:\/\//, "");

  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <Card>
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
        <div className="flex gap-5 items-center mb-5">
          {f.logoPreview || settings.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={f.logoPreview ?? settings.logoUrl!}
              alt={settings.name}
              className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-[72px] h-[72px] rounded-full text-white flex items-center justify-center font-display font-semibold text-[26px] flex-shrink-0"
              style={{ background: "var(--color-primary)" }}
            >
              {settings.monogram ?? settings.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <label className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[15px] cursor-pointer hover:bg-surface-hover transition-colors">
            <Upload size={18} />
            {f.logo ? f.logo.name : "Enviar logo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => f.setLogo(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <Input
            name="name"
            label="Nome da loja"
            value={f.storeName}
            onChange={(e) => f.setStoreName(e.target.value)}
          />
          <Input
            name="whatsapp"
            label="WhatsApp para pedidos"
            prefix="+55"
            value={f.whatsapp}
            onChange={(e) => f.setWhatsapp(e.target.value)}
          />
          <Input
            name="monogram"
            label="Monograma (até 3 letras)"
            placeholder="Ex: MR"
            maxLength={3}
            value={f.monogram}
            onChange={(e) => f.setMonogram(e.target.value)}
          />
          <div className="hidden sm:block" />
          <div className="sm:col-span-2">
            <Input
              name="description"
              label="Descrição curta"
              value={f.storeDescription}
              onChange={(e) => f.setStoreDescription(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Cor de destaque{" "}
          <span className="text-graphite font-normal">
            · aplicada nos botões primários e pills ativos
          </span>
        </h2>
        <div className="flex gap-3 flex-wrap mb-5">
          {ACCENT_COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => f.setAccent(c)}
              aria-label={c}
              className="w-10 h-10 rounded-full transition-all duration-200"
              style={{
                background: c,
                border:
                  f.accent === c
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                outline: f.accent === c ? "2px solid var(--color-bg)" : "none",
                outlineOffset: f.accent === c ? "-4px" : "0",
                boxSizing: "border-box",
              }}
            />
          ))}
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <span
            className="inline-flex min-h-11 items-center px-[22px] py-2.5 rounded-btn font-display font-medium text-[15px] text-white"
            style={{ background: f.accent }}
          >
            Comprar via WhatsApp
          </span>
          <span className="font-body text-[13px] text-graphite">
            Pré-visualização do CTA
          </span>
        </div>
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
              <WhatsPreviewText text={renderTemplate(f.msgTpl)} />
            </div>
          </div>
        </div>
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
    </div>
  );
}
