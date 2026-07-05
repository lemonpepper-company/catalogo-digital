import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CadastroForm } from "@/app/(auth)/cadastro/CadastroForm";

vi.mock("@/app/actions/auth", () => ({
  signUp: vi.fn(),
  createStore: vi.fn(),
  signOut: vi.fn(),
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

describe("CadastroForm — link de saída (novo)", () => {
  it("mostra link 'Voltar para o login' apontando para /login na etapa 1", () => {
    render(<CadastroForm />);
    const link = screen.getByRole("link", { name: /Voltar para o login/i });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("na etapa 2, mostra 'Sair' (sign out) em vez de um link para /login", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.queryByText(/Voltar para o login/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /login/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Sair/i })).toBeTruthy();
  });
});
