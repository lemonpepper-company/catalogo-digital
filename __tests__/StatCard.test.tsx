import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/ui/StatCard";

describe("StatCard", () => {
  it("mostra o valor e o rótulo por padrão", () => {
    render(<StatCard value={7} label="Pedidos" />);

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Pedidos")).toBeTruthy();
  });

  it("com loading, mostra o spinner e não mostra o valor", () => {
    render(<StatCard value={7} label="Pedidos" loading />);

    expect(screen.getByTestId("statcard-loading")).toBeTruthy();
    expect(screen.queryByText("7")).toBeNull();
    expect(screen.getByText("Pedidos")).toBeTruthy();
  });

  it("sem loading (padrão), não mostra o spinner", () => {
    render(<StatCard value={7} label="Pedidos" />);

    expect(screen.queryByTestId("statcard-loading")).toBeNull();
  });
});
