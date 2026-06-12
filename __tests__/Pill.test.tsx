import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pill } from "@/components/ui/Pill";

describe("Pill", () => {
  it("renders children", () => {
    render(<Pill>TODOS</Pill>);
    expect(screen.getByText("TODOS")).toBeTruthy();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Pill onClick={onClick}>BLUSAS</Pill>);
    fireEvent.click(screen.getByText("BLUSAS"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies active styles when active=true", () => {
    render(<Pill active>VESTIDOS</Pill>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-obsidian");
    expect(btn.className).toContain("text-white");
  });

  it("applies inactive styles when active=false", () => {
    render(<Pill active={false}>CALÇAS</Pill>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-linen");
  });
});
