import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

describe("RecursoBloqueado — estado bloqueado de recurso pago (ORD-28)", () => {
  it("anuncia que o recurso começa no plano Starter", () => {
    render(<RecursoBloqueado titulo="Histórico de pedidos" descricao="Faça upgrade." />);

    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.getByText("Histórico de pedidos")).toBeTruthy();
    expect(screen.getByText("Faça upgrade.")).toBeTruthy();
  });

  it("oferece o CTA de WhatsApp da Vtrine no padrão do banner de upgrade", () => {
    render(<RecursoBloqueado titulo="Histórico de pedidos" descricao="Faça upgrade." />);

    const link = screen.getByRole("link", { name: "Falar no WhatsApp →" });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Quero saber mais sobre os planos pagos da Vtrine."
      )}`
    );
  });

  it("anuncia o plano Pro quando o recurso é exclusivo dele (APO-09)", () => {
    render(
      <RecursoBloqueado
        titulo="Sua vitrine em números"
        descricao="Faça upgrade."
        planoMinimo="pro"
      />
    );

    expect(screen.getByText("Disponível no plano Pro")).toBeTruthy();
    expect(screen.queryByText("Disponível a partir do plano Starter")).toBeNull();
  });

  it("não exibe nenhum número real do recurso bloqueado", () => {
    const { container } = render(
      <RecursoBloqueado
        titulo="Histórico de pedidos"
        descricao="Faça upgrade para ver o histórico completo."
      />
    );

    expect(container.textContent).not.toMatch(/\d/);
    expect(container.textContent).not.toContain("R$");
  });

  it("também não exibe número algum na variante do Pro", () => {
    const { container } = render(
      <RecursoBloqueado
        titulo="Sua vitrine em números"
        descricao="Veja quantas pessoas visitam sua vitrine."
        planoMinimo="pro"
      />
    );

    expect(container.textContent).not.toMatch(/\d/);
    expect(container.textContent).not.toContain("R$");
  });
});
