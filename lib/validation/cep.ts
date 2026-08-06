/** Só dígitos — como o ViaCEP e o Asaas esperam. */
export function normalizarCep(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function validarCep(valor: string): boolean {
  return normalizarCep(valor).length === 8;
}
