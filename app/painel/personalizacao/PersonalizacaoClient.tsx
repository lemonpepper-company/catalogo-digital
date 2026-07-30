"use client";

import { Fragment } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { CorDestaqueFields } from "@/components/loja/CorDestaqueFields";
import { CapaFields } from "@/components/loja/CapaFields";
import { ThemeOptionsFields } from "@/components/painel/ThemeOptionsFields";
import { UpsellHint } from "@/components/painel/UpsellHint";
import { cn } from "@/lib/utils";
import { SECONDARY_COLOR_OPTIONS } from "@/lib/data";
import { PLAN_GATE_LABEL } from "@/lib/contact";
import type { StoreSettings } from "@/lib/types";
import type { PlanLimits } from "@/lib/plan-limits";
import { usePersonalizacao } from "./use-personalizacao";

export function PersonalizacaoClient({
  settings,
  limits,
}: {
  settings: StoreSettings;
  limits: PlanLimits;
}) {
  const f = usePersonalizacao(settings, limits);

  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <form action={f.formAction} className="flex flex-col gap-5">
        <h1 className="font-display font-semibold text-[28px] text-obsidian">
          Personalização
        </h1>

        <Card>
          <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
            Cor de destaque{" "}
            <span className="text-graphite font-normal">
              · aplicada nos botões primários e pills ativos
            </span>
          </h2>
          <CorDestaqueFields accent={f.accent} onAccentChange={f.setAccent} />

          <div className="mt-5 pt-5 border-t border-sand/50">
            <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
              Cor secundária (opcional){" "}
              <span className="text-graphite font-normal">
                · aplicada na categoria selecionada
              </span>
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {SECONDARY_COLOR_OPTIONS.map((c) => {
                const locked = !f.limits.advancedTheme;
                const button = (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => !locked && f.setSecondaryColor(c)}
                    aria-label={c}
                    className={cn(
                      "w-10 h-10 rounded-full transition-all duration-200",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                    style={{
                      background: c,
                      border:
                        f.secondaryColor === c
                          ? "2px solid var(--color-primary)"
                          : "1px solid var(--color-border)",
                      outline: f.secondaryColor === c ? "2px solid var(--color-bg)" : "none",
                      outlineOffset: f.secondaryColor === c ? "-4px" : "0",
                      boxSizing: "border-box",
                    }}
                  />
                );
                return locked ? (
                  <Tooltip key={c} label={PLAN_GATE_LABEL.pro}>
                    {button}
                  </Tooltip>
                ) : (
                  <Fragment key={c}>{button}</Fragment>
                );
              })}
            </div>
            {!f.limits.advancedTheme && (
              <div className="mt-2">
                <UpsellHint
                  label={`${PLAN_GATE_LABEL.pro} — fale conosco`}
                  whatsappMessage="Olá! Quero saber mais sobre desbloquear a cor secundária."
                />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
            Tema
          </h2>
          <p className="font-body text-[13px] text-graphite mb-4">
            Fonte, fundo e formato dos cantos da vitrine — cada escolha é independente.
          </p>
          <ThemeOptionsFields
            fontPairing={f.fontPairing}
            onFontPairingChange={f.setFontPairing}
            backgroundPalette={f.backgroundPalette}
            onBackgroundPaletteChange={f.setBackgroundPalette}
            cornerStyle={f.cornerStyle}
            onCornerStyleChange={f.setCornerStyle}
            unlocked={f.limits.themeOptions}
          />

          <div className="mt-5">
            <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
              Densidade do grid
            </label>
            <div className="flex gap-3">
              {(["padrao", "compacto"] as const).map((d) => {
                const locked = !f.limits.gridDensity && d !== "padrao";
                const button = (
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => f.setGridDensity(d)}
                    className={cn(
                      "h-11 px-4 rounded-btn border text-[13px]",
                      f.gridDensity === d
                        ? "border-obsidian bg-obsidian text-white"
                        : "border-sand bg-white text-obsidian hover:bg-surface-hover",
                      locked && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {d === "padrao" ? "Padrão" : "Compacto"}
                  </button>
                );
                return locked ? (
                  <Tooltip key={d} label={PLAN_GATE_LABEL.starter}>
                    {button}
                  </Tooltip>
                ) : (
                  <Fragment key={d}>{button}</Fragment>
                );
              })}
            </div>
          </div>

          {!f.limits.themeOptions && (
            <div className="mt-3">
              <UpsellHint
                label={`${PLAN_GATE_LABEL.starter} — fale conosco`}
                whatsappMessage="Olá! Quero saber mais sobre desbloquear as opções de tema."
              />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
            Capa da vitrine
          </h2>
          <p className="font-body text-[13px] text-graphite mb-4">
            Imagem de destaque exibida no topo do seu catálogo (promoções, avisos).
          </p>
          <CapaFields
            coverUrl={f.coverUrl}
            coverPreview={f.coverPreview}
            coverFileName={f.coverFileName}
            onCoverChange={f.setCover}
            onRemoveCover={f.clearCover}
          />
        </Card>

        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="ghost" onClick={() => history.back()}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={f.pending}>
            {f.pending ? "Salvando…" : "Salvar personalização"}
          </Button>
        </div>

        {f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}
      </form>
    </div>
  );
}
