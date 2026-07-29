"use client";

import { useActionState, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { importProductsCsv, type ImportCsvState } from "@/app/actions/produtos";

interface ImportarProdutosModalProps {
  onClose: () => void;
}

export function ImportarProdutosModal({ onClose }: ImportarProdutosModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [state, formAction, pending] = useActionState<ImportCsvState, FormData>(
    importProductsCsv,
    null
  );

  const result = state && "ok" in state ? state : null;

  return (
    <Modal title="Importar produtos" onClose={onClose}>
      {!result ? (
        <form
          action={(formData) => {
            if (file) formData.set("file", file);
            formAction(formData);
          }}
          className="flex flex-col gap-4"
        >
          <a
            href="/exemplo-importacao-produtos.csv"
            className="font-body text-[13px] text-obsidian underline w-fit"
          >
            Baixar planilha de exemplo
          </a>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-body text-[13px]"
          />
          {state && "error" in state && (
            <p className="font-body text-[13px] text-error">{state.error}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!file || pending}>
              {pending ? "Importando…" : "Importar"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-body text-[14px] text-obsidian">
            <strong>{result.created}</strong> produto(s) importado(s) com sucesso.
          </p>
          {result.errors.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
              <p className="font-body font-medium text-[13px] text-obsidian">
                {result.errors.length} linha(s) com erro:
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="font-body text-[13px] text-graphite">
                  Linha {e.line}: {e.reason}
                </p>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="primary" onClick={onClose}>
              Concluir
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
