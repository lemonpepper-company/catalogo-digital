"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { CorDestaqueFields } from "@/components/loja/CorDestaqueFields";
import { CapaFields } from "@/components/loja/CapaFields";
import { ThemeOptionsFields } from "@/components/painel/ThemeOptionsFields";
import { cn } from "@/lib/utils";
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

          {f.limits.advancedTheme && (
            <div className="mt-5">
              <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
                Cor secundária (opcional)
              </label>
              <input
                type="color"
                value={f.secondaryColor ?? "#000000"}
                onChange={(e) => f.setSecondaryColor(e.target.value)}
                className="h-11 w-20 rounded-btn border border-sand cursor-pointer"
              />
            </div>
          )}

          <div className="mt-5">
            <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
              Densidade do grid
            </label>
            <div className="flex gap-3">
              {(["padrao", "compacto"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!f.limits.gridDensity && d !== "padrao"}
                  onClick={() => f.setGridDensity(d)}
                  className={cn(
                    "h-11 px-4 rounded-btn border text-[13px]",
                    f.gridDensity === d
                      ? "border-obsidian bg-obsidian text-white"
                      : "border-sand bg-white text-obsidian hover:bg-surface-hover",
                    !f.limits.gridDensity && d !== "padrao" && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {d === "padrao" ? "Padrão" : "Compacto"}
                </button>
              ))}
            </div>
          </div>
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
