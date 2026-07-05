import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CadastroForm } from "@/app/(auth)/cadastro/CadastroForm";

vi.mock("@/app/actions/auth", () => ({
  signUp: vi.fn(),
  createStore: vi.fn(),
}));

describe("CadastroForm — etapas do cadastro (novo)", () => {
  it("mostra 'Sua conta' e esconde 'Sua loja' na etapa 1", () => {
    render(<CadastroForm />);
    expect(screen.getByText("Sua conta")).toBeTruthy();
    expect(screen.queryByText("Sua loja")).toBeNull();
    expect(screen.queryByPlaceholderText("Ex.: Ateliê Mira")).toBeNull();
  });

  it("mostra 'Sua loja' e esconde 'Sua conta' na etapa 2 (stepLoja)", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.getByText("Sua loja")).toBeTruthy();
    expect(screen.queryByText("Sua conta")).toBeNull();
    expect(screen.getByPlaceholderText("Ex.: Ateliê Mira")).toBeTruthy();
  });

  it("mostra o campo de Instagram na etapa 2", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.getByPlaceholderText("seu.usuario")).toBeTruthy();
  });
});
