import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportarProdutosModal } from "@/components/painel/ImportarProdutosModal";

vi.mock("@/app/actions/produtos", () => ({
  importProductsCsv: vi.fn(),
}));

function selectFile(input: HTMLElement) {
  const file = new File(["nome,preco\nVestido,10"], "produtos.csv", {
    type: "text/csv",
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("ImportarProdutosModal — smoke", () => {
  it("renderiza o modal com input de arquivo e link de planilha de exemplo", () => {
    render(<ImportarProdutosModal onClose={vi.fn()} />);
    expect(screen.getByText("Importar produtos")).toBeTruthy();
    expect(screen.getByText("Baixar planilha de exemplo")).toBeTruthy();
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
  });
});

describe("ImportarProdutosModal — lista de erros (regressão do prefixo 'Linha N:')", () => {
  it("não duplica 'Linha N:' quando o motivo já vem prefixado (erro de parsing)", async () => {
    const { importProductsCsv } = await import("@/app/actions/produtos");
    (importProductsCsv as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      created: 1,
      errors: [{ line: 3, reason: "Linha 3: nome é obrigatório." }],
    });

    render(<ImportarProdutosModal onClose={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input);
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));

    const errorLine = await screen.findByText("Linha 3: nome é obrigatório.");
    expect(errorLine).toBeTruthy();
    expect(screen.queryByText("Linha 3: Linha 3: nome é obrigatório.")).toBeNull();
  });

  it("prepende 'Linha N:' quando o motivo não vem prefixado (erro de insert no banco)", async () => {
    const { importProductsCsv } = await import("@/app/actions/produtos");
    (importProductsCsv as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      created: 1,
      errors: [{ line: 4, reason: "Erro ao criar o produto." }],
    });

    render(<ImportarProdutosModal onClose={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    selectFile(input);
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));

    expect(
      await screen.findByText("Linha 4: Erro ao criar o produto.")
    ).toBeTruthy();
  });
});
