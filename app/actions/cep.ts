"use server";

import { validarCep, normalizarCep } from "@/lib/validation/cep";
import { buscarEnderecoPorCep } from "@/lib/server/cep";

export type EnderecoAutofill = { logradouro: string; bairro: string; cidade: string } | null;

/**
 * Autofill best-effort dos campos de endereço a partir do CEP, chamado pelo
 * cliente ao sair do campo CEP. Nem todo CEP devolve rua/bairro/cidade no
 * ViaCEP — os campos continuam editáveis no formulário e isto é só uma
 * sugestão, nunca bloqueia o preenchimento manual nem o salvamento.
 */
export async function buscarEndereco(cep: string): Promise<EnderecoAutofill> {
  if (!validarCep(cep)) return null;
  return buscarEnderecoPorCep(normalizarCep(cep));
}
