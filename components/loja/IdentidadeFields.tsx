"use client";

import { Upload } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface IdentidadeFieldsProps {
  nameForInitials: string;
  logoUrl?: string | null;
  logoPreview: string | null;
  logoFileName?: string | null;
  onLogoChange: (file: File | null) => void;
  whatsapp: string;
  onWhatsappChange: (value: string) => void;
  monogram: string;
  onMonogramChange: (value: string) => void;
  instagram: string;
  onInstagramChange: (value: string) => void;
  storeDescription: string;
  onStoreDescriptionChange: (value: string) => void;
  children?: React.ReactNode;
}

export function IdentidadeFields({
  nameForInitials,
  logoUrl,
  logoPreview,
  logoFileName,
  onLogoChange,
  whatsapp,
  onWhatsappChange,
  monogram,
  onMonogramChange,
  instagram,
  onInstagramChange,
  storeDescription,
  onStoreDescriptionChange,
  children,
}: IdentidadeFieldsProps) {
  return (
    <>
      <div className="flex gap-5 items-center mb-5">
        {logoPreview || logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoPreview ?? logoUrl!}
            alt={nameForInitials}
            className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-[72px] h-[72px] rounded-full text-white flex items-center justify-center font-display font-semibold text-[26px] flex-shrink-0"
            style={{ background: "var(--color-primary)" }}
          >
            {monogram || nameForInitials.slice(0, 2).toUpperCase()}
          </div>
        )}
        <label className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[15px] cursor-pointer hover:bg-surface-hover transition-colors">
          <Upload size={18} />
          {logoFileName ?? "Enviar logo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {children}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
        <Input
          name="whatsapp"
          label="WhatsApp para pedidos"
          prefix="+55"
          value={whatsapp}
          onChange={(e) => onWhatsappChange(e.target.value)}
        />
        <Input
          name="monogram"
          label="Monograma (até 3 letras)"
          placeholder="Ex: MR"
          maxLength={3}
          value={monogram}
          onChange={(e) => onMonogramChange(e.target.value)}
        />
        <Input
          name="instagram"
          label="Instagram (opcional)"
          prefix="@"
          value={instagram}
          onChange={(e) => onInstagramChange(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Input
            name="description"
            label="Descrição curta"
            value={storeDescription}
            onChange={(e) => onStoreDescriptionChange(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
