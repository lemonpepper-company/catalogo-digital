import "server-only";

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  erro?: boolean;
}

/**
 * Sugere rua/bairro/cidade a partir do CEP, pra pré-preencher o formulário
 * — o lojista sempre pode editar ou completar manualmente. Nem todo CEP tem
 * os três dados no ViaCEP (CEPs de agrupamento, área rural, construção
 * nova), então campos ausentes voltam como string vazia em vez de
 * invalidar a busca inteira. Serviço público, sem autenticação, sem SLA
 * formal; só devolve null se o CEP não existe ou a busca falhar — inclusive
 * por timeout: sem um limite, um request pendurado seguraria a Server
 * Action (updateStoreSettings/salvarEndereco) até o limite da função.
 */
export async function buscarEnderecoPorCep(
  cep: string
): Promise<{ logradouro: string; bairro: string; cidade: string } | null> {
  let resposta: Response;
  try {
    resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null;
  }
  if (!resposta.ok) return null;

  const dados = (await resposta.json()) as ViaCepResponse;
  if (dados.erro) return null;

  return {
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
  };
}
