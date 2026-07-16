"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { CorDestaqueFields } from "@/components/loja/CorDestaqueFields";
import { CapaFields } from "@/components/loja/CapaFields";
import type { StoreSettings } from "@/lib/types";
import { usePersonalizacao } from "./use-personalizacao";

export function PersonalizacaoClient({ settings }: { settings: StoreSettings }) {
  const f = usePersonalizacao(settings);

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
