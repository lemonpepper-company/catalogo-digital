import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Clique aqui</Button>);
    expect(screen.getByText("Clique aqui")).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Botão</Button>);
    fireEvent.click(screen.getByText("Botão"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Desabilitado
      </Button>
    );
    fireEvent.click(screen.getByText("Desabilitado"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders iconLeft", () => {
    render(
      <Button iconLeft={<span data-testid="icon" />}>Com ícone</Button>
    );
    expect(screen.getByTestId("icon")).toBeTruthy();
  });

  it("applies primary variant classes by default", () => {
    render(<Button>Primário</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-obsidian");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border-sand");
  });

  it("applies cta variant classes", () => {
    render(<Button variant="cta">CTA</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-gold");
  });
});
