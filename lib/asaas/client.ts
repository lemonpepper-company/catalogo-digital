import "server-only";

/**
 * Cliente HTTP do Asaas. Não conhece assinatura, plano nem loja — só fala o
 * protocolo. A chave nunca tem prefixo NEXT_PUBLIC_ (não pode entrar no bundle)
 * e nunca aparece em mensagem de erro.
 */
export async function asaasFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada — a cobrança está indisponível.");
  }
  const baseUrl = process.env.ASAAS_BASE_URL?.trim() ?? "https://api-sandbox.asaas.com/v3";

  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const texto = await response.text();

  if (!response.ok) {
    // O Asaas devolve { errors: [{ code, description }] }. Preferimos a
    // descrição dele à nossa: ela costuma dizer exatamente qual campo recusou.
    let detalhe = `HTTP ${response.status}`;
    try {
      const corpo = JSON.parse(texto) as { errors?: { description?: string }[] };
      const primeira = corpo.errors?.[0]?.description;
      if (primeira) detalhe = primeira;
    } catch {
      // corpo não-JSON: mantém o status. Nunca ecoa o texto cru, que pode
      // conter dados da requisição.
    }
    throw new Error(`Asaas: ${detalhe}`);
  }

  return (texto ? JSON.parse(texto) : {}) as T;
}
