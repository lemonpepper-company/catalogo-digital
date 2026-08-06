"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { buscarEndereco } from "@/app/actions/cep";
import { validarCep } from "@/lib/validation/cep";

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
  document?: string | null;
  postalCode?: string | null;
  addressNumber?: string | null;
  address?: string | null;
  addressProvince?: string | null;
  addressCity?: string | null;
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
  document,
  postalCode,
  addressNumber,
  address,
  addressProvince,
  addressCity,
  children,
}: IdentidadeFieldsProps) {
  const [cep, setCep] = useState(postalCode ?? "");
  const [rua, setRua] = useState(address ?? "");
  const [bairro, setBairro] = useState(addressProvince ?? "");
  const [cidade, setCidade] = useState(addressCity ?? "");

  // Sugere rua/bairro/cidade a partir do CEP ao sair do campo — nem todo
  // CEP tem os três dados no ViaCEP, então só preenche o que veio e nunca
  // sobrescreve o que o lojista já tiver digitado manualmente.
  async function autopreencherPorCep() {
    if (!validarCep(cep)) return;
    const encontrado = await buscarEndereco(cep);
    if (!encontrado) return;
    setRua((atual) => atual || encontrado.logradouro);
    setBairro((atual) => atual || encontrado.bairro);
    setCidade((atual) => atual || encontrado.cidade);
  }

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
        <div className="sm:col-span-2">
          <Input
            name="document"
            label="CPF ou CNPJ"
            hint="Opcional — necessário apenas para assinar um plano pago"
            placeholder="000.000.000-00"
            defaultValue={document ?? ""}
          />
        </div>
        <Input
          name="postalCode"
          label="CEP"
          hint="Opcional — necessário apenas para assinar via cartão"
          placeholder="00000-000"
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          onBlur={autopreencherPorCep}
        />
        <Input
          name="addressNumber"
          label="Número"
          placeholder="Ex: 123"
          defaultValue={addressNumber ?? ""}
        />
        <Input
          name="address"
          label="Rua"
          hint="Preenchida pelo CEP quando possível — confira ou complete manualmente"
          placeholder="Ex: Rua das Flores"
          value={rua}
          onChange={(e) => setRua(e.target.value)}
        />
        <Input
          name="addressProvince"
          label="Bairro"
          placeholder="Ex: Centro"
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Input
            name="addressCity"
            label="Cidade"
            placeholder="Ex: São Paulo"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
