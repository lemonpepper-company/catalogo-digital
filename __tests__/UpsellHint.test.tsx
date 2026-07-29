import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpsellHint } from "@/components/painel/UpsellHint";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

describe("UpsellHint", () => {
  it("renderiza o texto informado como link", () => {
    render(
      <UpsellHint
        label="Disponível no Starter — fale conosco"
        whatsappMessage="Olá! Quero saber mais."
      />
    );
    expect(
      screen.getByRole("link", { name: "Disponível no Starter — fale conosco" })
    ).toBeTruthy();
  });

  it("aponta para o WhatsApp da Vtrine com a mensagem informada", () => {
    render(
      <UpsellHint
        label="Disponível no Pro — fale conosco"
        whatsappMessage="Olá! Quero saber mais sobre a cor secundária."
      />
    );
    const link = screen.getByRole("link", { name: "Disponível no Pro — fale conosco" });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Quero saber mais sobre a cor secundária."
      )}`
    );
  });

  it("abre em nova aba com segurança", () => {
    render(<UpsellHint label="Disponível no Starter — fale conosco" whatsappMessage="Oi" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
