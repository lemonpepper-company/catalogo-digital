import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Switch, ToggleRow } from "@/components/ui/Switch";

describe("Switch", () => {
  it("renders a button with type=button", () => {
    render(<Switch checked={false} onChange={vi.fn()} />);
    const btn = screen.getByRole("switch");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("does not submit a parent form when clicked", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <Switch checked={false} onChange={onChange} />
      </form>
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("ToggleRow", () => {
  it("does not submit a parent form when clicked", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const onChange = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <ToggleRow label="Novidade" checked={true} onChange={onChange} />
      </form>
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
