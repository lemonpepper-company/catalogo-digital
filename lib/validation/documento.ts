/** Só dígitos — é como o Asaas espera e como gravamos. */
export function normalizarDocumento(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitosIguais(d: string): boolean {
  return /^(\d)\1+$/.test(d);
}

function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11 || digitosIguais(cpf)) return false;

  const dv = (ate: number, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return dv(9, 10) === Number(cpf[9]) && dv(10, 11) === Number(cpf[10]);
}

function validarCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || digitosIguais(cnpj)) return false;

  const dv = (ate: number) => {
    let soma = 0;
    let peso = ate - 7;
    for (let i = 0; i < ate; i++) {
      soma += Number(cnpj[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

/**
 * Aceita CPF ou CNPJ, com ou sem máscara. Validado ANTES de qualquer chamada ao
 * Asaas: erro de dígito verificador é diagnóstico nosso, e devolver a mensagem
 * crua de um terceiro para algo que sabemos explicar é ruim para o lojista.
 */
export function validarDocumento(valor: string): boolean {
  const d = normalizarDocumento(valor);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}
