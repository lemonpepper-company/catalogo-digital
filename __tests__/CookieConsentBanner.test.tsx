import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieConsentBanner } from "@/components/analytics/CookieConsentBanner";

describe("CookieConsentBanner", () => {
  it("mostra o texto e o link para a política de privacidade", () => {
    render(<CookieConsentBanner onAccept={() => {}} onReject={() => {}} />);
    expect(screen.getByText(/cookies/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /política de privacidade/i })).toHaveAttribute(
      "href",
      "/politica-de-privacidade"
    );
  });

  it("chama onAccept ao clicar em Aceitar", async () => {
    const onAccept = vi.fn();
    render(<CookieConsentBanner onAccept={onAccept} onReject={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /aceitar/i }));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it("chama onReject ao clicar em Recusar", async () => {
    const onReject = vi.fn();
    render(<CookieConsentBanner onAccept={() => {}} onReject={onReject} />);
    await userEvent.click(screen.getByRole("button", { name: /recusar/i }));
    expect(onReject).toHaveBeenCalledOnce();
  });
});
