"use client";

import { useState } from "react";
import { Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Toast } from "@/components/ui/Toast";
import { STORE, ACCENT_COLOR_OPTIONS } from "@/lib/data";
import type { ToastState } from "@/lib/types";

const MSG_DEFAULT = `{saudacao}\n\n{itens}\n\n━━━━━━━━━━━━━━━━━\n*Total: {total}*\n━━━━━━━━━━━━━━━━━`;

export default function ConfiguracoesPage() {
  const [accent, setAccent] = useState(STORE.accentColor);
  const [msgTpl, setMsgTpl] = useState(MSG_DEFAULT);
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const lightColors = new Set(["#FFFFFF"]);

  return (
    <div className="max-w-form flex flex-col gap-5">
      <h1 className="font-display font-semibold text-[28px] text-obsidian">
        Configurações da loja
      </h1>

      {/* Identity */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Identidade
        </h2>
        <div className="flex gap-5 items-center mb-5">
          <div className="w-[72px] h-[72px] rounded-full bg-obsidian text-white flex items-center justify-center font-display font-semibold text-[26px] flex-shrink-0">
            {STORE.monogram}
          </div>
          <Button variant="ghost" iconLeft={<Upload size={18} />}>
            Enviar logo
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-[18px]">
          <Input label="Nome da loja" defaultValue={STORE.name} />
          <Input
            label="WhatsApp para pedidos"
            prefix="+55"
            defaultValue="11 99999-0000"
          />
          <div className="col-span-2">
            <Input
              label="Descrição curta"
              defaultValue={STORE.description}
            />
          </div>
        </div>
      </Card>

      {/* Accent color */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-1.5">
          Cor de destaque{" "}
          <span className="text-graphite font-normal">
            · aplicada nos botões primários e pills ativos
          </span>
        </h2>
        <p className="font-body text-[13px] text-graphite mb-4">
          Escolha a cor que representa sua marca no catálogo.
        </p>
        <div className="flex gap-3 flex-wrap mb-5">
          {ACCENT_COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setAccent(c)}
              aria-label={c}
              className="w-10 h-10 rounded-full transition-all duration-200"
              style={{
                background: c,
                border:
                  accent === c
                    ? "2px solid var(--color-primary)"
                    : "1px solid var(--color-border)",
                outline: accent === c ? `2px solid ${c}` : "none",
                outlineOffset: accent === c ? "-4px" : "0",
                boxSizing: "border-box",
              }}
            >
              {accent === c && (
                <Check
                  size={16}
                  className={
                    lightColors.has(c) ? "text-obsidian" : "text-white"
                  }
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-11 items-center px-[22px] rounded-btn font-display font-medium text-[15px] text-white"
            style={{ background: accent }}
          >
            Comprar via WhatsApp
          </span>
          <span className="font-body text-[13px] text-graphite">
            Pré-visualização do CTA
          </span>
        </div>
      </Card>

      {/* WhatsApp message template */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
          Mensagem do pedido{" "}
          <span className="text-graphite font-normal">
            · enviada no WhatsApp ao finalizar a sacola
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-6 mt-4 items-start">
          <div className="flex flex-col gap-3">
            <textarea
              value={msgTpl}
              onChange={(e) => setMsgTpl(e.target.value)}
              rows={11}
              className="w-full px-3.5 py-3 bg-white border border-sand rounded-input font-mono text-[13px] leading-relaxed text-obsidian outline-none focus:border-obsidian resize-y"
            />
            <div className="flex flex-wrap gap-2">
              {[
                { token: "{saudacao}", desc: "saudação inicial" },
                { token: "{itens}", desc: "lista de itens" },
                { token: "{total}", desc: "valor total" },
              ].map((v) => (
                <button
                  key={v.token}
                  title={`Inserir ${v.desc}`}
                  className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-pill border border-sand bg-linen font-mono text-[12.5px] text-obsidian hover:bg-surface-hover transition-colors cursor-pointer"
                  onClick={() => setMsgTpl((t) => t + v.token)}
                >
                  <span className="text-gold">+</span>
                  {v.token}
                </button>
              ))}
            </div>
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMsgTpl(MSG_DEFAULT);
                  flash("Mensagem restaurada");
                }}
              >
                Restaurar padrão
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Pré-visualização
            </span>
            <div className="bg-linen border border-sand/50 rounded-card p-4 font-mono text-[12.5px] leading-relaxed text-graphite whitespace-pre-wrap break-words">
              {msgTpl
                .replace(
                  "{saudacao}",
                  "Olá! Gostaria de fazer um pedido:"
                )
                .replace(
                  "{itens}",
                  "01. Vestido midi linho\n    Quantidade: 1x | R$ 289,90\n    Tamanho: M\n    Subtotal: R$ 289,90"
                )
                .replace("{total}", "R$ 289,90")}
            </div>
          </div>
        </div>
      </Card>

      {/* Integrations */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Integrações
        </h2>
        <div className="grid grid-cols-2 gap-[18px]">
          <Input
            label="Google Analytics ID"
            hint="Ex: G-XXXXXXXXXX"
            placeholder="G-XXXXXXXXXX"
          />
          <Input
            label="Facebook Pixel ID"
            hint="Apenas números"
            placeholder="000000000000000"
          />
        </div>
      </Card>

      {/* Footer actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Button variant="ghost">Cancelar</Button>
        <Button
          variant="primary"
          onClick={() => flash("Configurações salvas")}
        >
          Salvar alterações
        </Button>
      </div>

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}
