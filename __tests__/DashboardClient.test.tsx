import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardClient } from "@/app/painel/DashboardClient";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { CatalogAnalytics } from "@/lib/server/analytics";
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

function makeAnalytics(overrides: Partial<CatalogAnalytics> = {}): CatalogAnalytics {
  return {
    metrics: { visits: 120, uniqueVisitors: 84, buyClicks: 9, bagVisitors: 20 },
    topProducts: [],
    ...overrides,
  };
}

function renderDashboard(
  metrics: OrderMetrics | null,
  products: StoreProduct[] = [],
  analytics: CatalogAnalytics | null = null
) {
  return render(
    <DashboardClient
      products={products}
      storeName="Ateliê Mira"
      metrics={metrics}
      analytics={analytics}
    />
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

  it("mostra o filtro de período uma única vez, governando as duas seções", () => {
    renderDashboard(metrics, [], makeAnalytics());

    // getByRole falha se houver mais de um: prova que não nasceu um segundo
    // seletor junto da seção de analytics (ANL-14).
    const filtro = screen.getByRole("group", { name: "Filtrar por período" });
    expect(filtro).toBeTruthy();

    // E ele vem ANTES das duas seções que governa.
    const vendas = screen.getByText("Vendas pela vitrine");
    const vitrine = screen.getByText("Sua vitrine em números");
    expect(filtro.compareDocumentPosition(vendas)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(filtro.compareDocumentPosition(vitrine)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

describe("DashboardClient — seção da vitrine em números (ANL-12, ANL-13, ANL-16)", () => {
  const metrics: OrderMetrics = {
    ordersThisMonth: 5,
    confirmedCentsThisMonth: 100000,
    pendingCount: 1,
  };

  it("mostra visitas, únicos, cliques em comprar e conversão do período", () => {
    renderDashboard(metrics, [], makeAnalytics());

    expect(statValue("Visitas")).toBe("120");
    expect(statValue("Visitantes únicos")).toBe("84");
    expect(statValue("Cliques em comprar")).toBe("9");
    // 5 pedidos ÷ 20 visitantes com sacola = 25%
    expect(statValue("Conversão sacola → pedido")).toBe("25%");
  });

  it("calcula a conversão com os pedidos já carregados, sem fetch novo", () => {
    renderDashboard(
      { ...metrics, ordersThisMonth: 3 },
      [],
      makeAnalytics({ metrics: { visits: 10, uniqueVisitors: 8, buyClicks: 2, bagVisitors: 8 } })
    );

    // 3 ÷ 8 = 37,5%
    expect(statValue("Conversão sacola → pedido")).toBe("37.5%");
  });

  it("mostra zeros e conversão '—' quando não houve evento no período (ANL-16)", () => {
    renderDashboard(
      { ordersThisMonth: 0, confirmedCentsThisMonth: 0, pendingCount: 0 },
      [],
      makeAnalytics({
        metrics: { visits: 0, uniqueVisitors: 0, buyClicks: 0, bagVisitors: 0 },
      })
    );

    expect(statValue("Visitas")).toBe("0");
    expect(statValue("Visitantes únicos")).toBe("0");
    expect(statValue("Cliques em comprar")).toBe("0");
    expect(statValue("Conversão sacola → pedido")).toBe("—");
  });

  it("exibe conversão acima de 100% sem capar (edge da spec)", () => {
    renderDashboard(
      { ...metrics, ordersThisMonth: 6 },
      [],
      makeAnalytics({ metrics: { visits: 9, uniqueVisitors: 4, buyClicks: 5, bagVisitors: 3 } })
    );

    expect(statValue("Conversão sacola → pedido")).toBe("200%");
  });

  it("avisa que está indisponível quando a leitura falhou, sem esconder pedidos", () => {
    renderDashboard(metrics, [], null);

    expect(screen.getByText("Não foi possível carregar agora.")).toBeTruthy();
    expect(screen.queryByText("Visitas")).toBeNull();
    // Zero real (acima) mostra 0; indisponível não inventa número nenhum.
    expect(statValue("Pedidos")).toBe("5");
  });
});

describe("DashboardClient — produtos mais vistos (ANL-13)", () => {
  const metrics: OrderMetrics = {
    ordersThisMonth: 5,
    confirmedCentsThisMonth: 100000,
    pendingCount: 1,
  };

  const catalogo = [
    makeProduct({ id: "p1", name: "Vestido midi" }),
    makeProduct({ id: "p2", name: "Blusa de tricô" }),
  ];

  it("lista os mais vistos com nome e contagem, na ordem vinda do servidor", () => {
    renderDashboard(metrics, catalogo, {
      metrics: makeAnalytics().metrics,
      topProducts: [
        { productId: "p2", views: 31 },
        { productId: "p1", views: 12 },
      ],
    });

    const itens = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(itens).toEqual(["Blusa de tricô31 visualizações", "Vestido midi12 visualizações"]);
  });

  it("usa o singular quando o produto teve uma única visualização", () => {
    renderDashboard(metrics, catalogo, {
      metrics: makeAnalytics().metrics,
      topProducts: [{ productId: "p1", views: 1 }],
    });

    expect(screen.getByRole("listitem").textContent).toBe("Vestido midi1 visualização");
  });

  it("filtra produto deletado, mantendo os que ainda existem", () => {
    renderDashboard(metrics, catalogo, {
      metrics: makeAnalytics().metrics,
      topProducts: [
        { productId: "p1", views: 9 },
        { productId: "deletado", views: 40 },
      ],
    });

    const itens = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(itens).toEqual(["Vestido midi9 visualizações"]);
  });

  it("avisa quando nenhum produto foi visto no período", () => {
    renderDashboard(metrics, catalogo, makeAnalytics({ topProducts: [] }));

    expect(screen.getByText("Nenhum produto foi visto neste período.")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
