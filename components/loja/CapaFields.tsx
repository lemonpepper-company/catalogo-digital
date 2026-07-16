"use client";

import { Upload, Trash2 } from "lucide-react";

interface CapaFieldsProps {
  coverUrl?: string | null;
  coverPreview: string | null;
  coverFileName?: string | null;
  onCoverChange: (file: File | null) => void;
  onRemoveCover: () => void;
}

export function CapaFields({
  coverUrl,
  coverPreview,
  coverFileName,
  onCoverChange,
  onRemoveCover,
}: CapaFieldsProps) {
  const shown = coverPreview ?? coverUrl ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full aspect-[3/1] rounded-card overflow-hidden border border-sand bg-linen">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Prévia da capa" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-body text-[13px] text-graphite">
            Nenhuma capa enviada
          </div>
        )}
      </div>
      <div className="flex items-center flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[15px] cursor-pointer hover:bg-surface-hover transition-colors">
          <Upload size={18} />
          {coverFileName ?? "Enviar capa"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {shown && (
          <button
            type="button"
            onClick={onRemoveCover}
            className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-btn font-display font-medium text-[15px] text-error hover:bg-surface-hover transition-colors"
          >
            <Trash2 size={18} />
            Remover
          </button>
        )}
      </div>
      <p className="font-body text-[13px] text-graphite">
        Proporção recomendada 3:1 (ex.: 1200×400px). Imagens fora dessa proporção são recortadas.
      </p>
    </div>
  );
}
