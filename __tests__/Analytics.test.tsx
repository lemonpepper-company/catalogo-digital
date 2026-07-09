import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Analytics } from "@/components/analytics/Analytics";

beforeEach(() => {
  window.localStorage.clear();
});

describe("Analytics", () => {
  it("não mostra o banner nem carrega script quando não há gaId", () => {
    render(<Analytics gaId={undefined} />);
    expect(screen.queryByRole("region", { name: /consentimento de cookies/i })).toBeNull();
  });

  it("mostra o banner quando há gaId e nenhuma decisão salva", () => {
    render(<Analytics gaId="G-TEST123" />);
    expect(screen.getByRole("region", { name: /consentimento de cookies/i })).toBeInTheDocument();
  });

  it("não mostra o banner quando já existe uma decisão salva (aceita)", () => {
    window.localStorage.setItem("cookie-consent", "accepted");
    render(<Analytics gaId="G-TEST123" />);
    expect(screen.queryByRole("region", { name: /consentimento de cookies/i })).toBeNull();
  });

  it("não mostra o banner quando já existe uma decisão salva (recusada)", () => {
    window.localStorage.setItem("cookie-consent", "rejected");
    render(<Analytics gaId="G-TEST123" />);
    expect(screen.queryByRole("region", { name: /consentimento de cookies/i })).toBeNull();
  });

  it("esconde o banner após clicar em Aceitar", async () => {
    render(<Analytics gaId="G-TEST123" />);
    await userEvent.click(screen.getByRole("button", { name: /aceitar/i }));
    expect(screen.queryByRole("region", { name: /consentimento de cookies/i })).toBeNull();
    expect(window.localStorage.getItem("cookie-consent")).toBe("accepted");
  });

  it("esconde o banner após clicar em Recusar", async () => {
    render(<Analytics gaId="G-TEST123" />);
    await userEvent.click(screen.getByRole("button", { name: /recusar/i }));
    expect(screen.queryByRole("region", { name: /consentimento de cookies/i })).toBeNull();
    expect(window.localStorage.getItem("cookie-consent")).toBe("rejected");
  });
});
