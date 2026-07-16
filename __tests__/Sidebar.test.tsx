import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/painel/Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/painel",
}));

describe("Sidebar", () => {
  it("renders the logo image when logoUrl is present", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl="https://cdn.test/logo.jpg"
        slug="ateliemira"
      />
    );
    const img = screen.getByRole("img", { name: "Ateliê Mira" });
    expect(img.getAttribute("src")).toBe("https://cdn.test/logo.jpg");
    expect(screen.queryByText("AM")).toBeNull();
  });

  it("falls back to the monogram when there is no logo", () => {
    render(
      <Sidebar name="Ateliê Mira" monogram="AM" logoUrl={null} slug="ateliemira" />
    );
    expect(screen.getByText("AM")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the real store name", () => {
    render(
      <Sidebar name="Loja Nova" monogram={null} logoUrl={null} slug="loja-nova" />
    );
    expect(screen.getByText("Loja Nova")).toBeTruthy();
    // monogram derived from name when null
    expect(screen.getByText("LO")).toBeTruthy();
  });

  it("mostra o item de navegação Personalização", () => {
    render(
      <Sidebar name="Ateliê Mira" monogram="AM" logoUrl={null} slug="ateliemira" />
    );
    expect(screen.getByText("Personalização")).toBeTruthy();
  });
});
