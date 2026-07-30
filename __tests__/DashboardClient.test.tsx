import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardClient } from "@/app/painel/DashboardClient";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function makeProduct(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: "p1",
    name: "Vestido midi",
    priceCents: 19900,
    description: null,
    categoryId: null,
    sizes: [],
    soldSizes: [],
    colors: [],
    images: [],
    stock: 10,
    isActive: true,
    isNew: false,
    isFeatured: false,
    ...overrides,
  };
}

function renderDashboard(metrics: OrderMetrics | null, products: StoreProduct[] = []) {
  return render(
    <DashboardClient products={products} storeName="Ateliê Mira" metrics={metrics} />
  );
}

/** Valor do StatCard cujo rótulo é `label` (value e label são spans irmãos). */
function statValue(label: string): string | null | undefined {
  return screen.getByText(label).previousElementSibling?.textContent;
}

describe("DashboardClient — cards de ROI (ORD-17, ORD-18, ORD-19)", () => {
  const metrics: OrderMetrics = {
    ordersThisMonth: 7,
    confirmedCentsThisMonth: 123450,
    pendingCount: 3,
  };

  it("mostra a contagem de pedidos do período", () => {
    renderDashboard(metrics);

    expect(statValue("Pedidos")).toBe("7");
  });

  it("mostra as vendas confirmadas do período formatadas em reais", () => {
    renderDashboard(metrics);

    expect(statValue("Vendas confirmadas")).toBe("R$ 1234,50");
  });

  it("mostra a contagem de pedidos aguardando confirmação", () => {
    renderDashboard(metrics);

    expect(statValue("Aguardando confirmação")).toBe("3");
  });

  it("leva para o histórico de pedidos", () => {
    renderDashboard(metrics);

    expect(screen.getByRole("link", { name: "Ver pedidos" }).getAttribute("href")).toBe(
      "/painel/pedidos"
    );
  });

  it("mostra o filtro de período junto dos cards de vendas", () => {
    renderDashboard(metrics);

    expect(screen.getByRole("group", { name: "Filtrar por período" })).toBeTruthy();
  });

  it("não mostra loading nos cards de vendas antes de qualquer troca de período", () => {
    renderDashboard(metrics);

    expect(screen.queryAllByTestId("statcard-loading")).toHaveLength(0);
  });
});

describe("DashboardClient — métricas zeradas (ORD-20)", () => {
  it("mostra 0 e R$ 0,00 quando a loja não tem pedidos no período", () => {
    renderDashboard({
      ordersThisMonth: 0,
      confirmedCentsThisMonth: 0,
      pendingCount: 0,
    });

    expect(statValue("Pedidos")).toBe("0");
    expect(statValue("Vendas confirmadas")).toBe("R$ 0,00");
    expect(statValue("Aguardando confirmação")).toBe("0");
  });
});

describe("DashboardClient — bloqueio no plano Free (ORD-29)", () => {
  it("substitui os três cards de ROI pelo aviso de upgrade com CTA", () => {
    renderDashboard(null);

    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Falar no WhatsApp →" })).toBeTruthy();
    expect(screen.queryByText("Pedidos")).toBeNull();
    expect(screen.queryByText("Vendas confirmadas")).toBeNull();
    expect(screen.queryByText("Aguardando confirmação")).toBeNull();
  });

  it("não exibe nenhum valor de faturamento no HTML", () => {
    const { container } = renderDashboard(null);

    expect(container.textContent).not.toContain("R$");
  });

  it("não mostra o filtro de período quando o plano está bloqueado", () => {
    renderDashboard(null);

    expect(screen.queryByRole("group", { name: "Filtrar por período" })).toBeNull();
  });

  it("mantém os cards de produtos intactos", () => {
    renderDashboard(null, [makeProduct(), makeProduct({ id: "p2", stock: 0 })]);

    expect(statValue("Produtos ativos")).toBe("1");
    expect(statValue("Produtos esgotados")).toBe("1");
    expect(statValue("Produtos no catálogo")).toBe("2");
  });
});

describe("DashboardClient — produtos recentes removido (ORD-47)", () => {
  it("não mostra mais a lista de produtos recentes", () => {
    renderDashboard(null, [makeProduct()]);

    expect(screen.queryByText("Produtos recentes")).toBeNull();
    expect(screen.queryByText("Vestido midi")).toBeNull();
  });
});

describe("DashboardClient — dashboard paga não tem link de catálogo nem novo produto (ORD-48)", () => {
  it("não mostra o botão de cadastrar produto", () => {
    renderDashboard(null);

    expect(screen.queryByRole("link", { name: /cadastrar produto/i })).toBeNull();
  });

  it("não mostra o card de link do catálogo", () => {
    renderDashboard(null);

    expect(screen.queryByText("Link do catálogo")).toBeNull();
    expect(screen.queryByRole("button", { name: /copiar link/i })).toBeNull();
  });
});
