import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { PedidosClient } from "@/app/painel/pedidos/PedidosClient";
import type { StoreOrder } from "@/lib/types";

const updateOrderStatus = vi.fn();
const replace = vi.fn();

vi.mock("@/app/actions/pedidos", () => ({
  updateOrderStatus: (...args: unknown[]) => updateOrderStatus(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  updateOrderStatus.mockReset();
  updateOrderStatus.mockResolvedValue({ ok: true });
  replace.mockReset();
});

function makeOrder(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: "o1",
    code: "HS0L52",
    createdAt: "2026-07-27T15:30:00.000Z",
    customerName: "Ana",
    paymentMethod: "pix",
    deliveryMethod: "retirada",
    deliveryAddress: null,
    itemsCount: 3,
    totalCents: 47800,
    status: "pendente",
    items: [
      {
        productName: "Vestido midi",
        unitPriceCents: 19900,
        qty: 2,
        size: "M",
        color: "Areia",
      },
      { productName: "Blusa", unitPriceCents: 8000, qty: 1, size: null, color: null },
    ],
    ...overrides,
  };
}

function openDetail(order: StoreOrder): HTMLElement {
  fireEvent.click(
    screen.getByLabelText(
      `Ver detalhe do pedido de ${order.customerName ?? "Sem nome"}`
    )
  );
  return screen.getByRole("dialog", { name: "Detalhe do pedido" });
}

describe("PedidosClient — lista do histórico (ORD-12)", () => {
  it("mostra data/hora, nome do cliente, quantidade de itens, total e status", () => {
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("27/07/2026, 12:30 · 3 itens")).toBeTruthy();
    expect(screen.getByText("R$ 478,00")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
  });

  it('mostra "Sem nome" quando o cliente não informou o nome', () => {
    render(
      <PedidosClient
        orders={[makeOrder({ customerName: null })]}
        total={1}
        page={1}
        totalPages={1}
      />
    );

    expect(screen.getByText("Sem nome")).toBeTruthy();
  });

  it("preserva a ordem recebida do servidor (mais recente primeiro)", () => {
    render(
      <PedidosClient
        orders={[
          makeOrder({ id: "o1", customerName: "Recente" }),
          makeOrder({ id: "o2", customerName: "Antigo" }),
        ]}
        total={2}
        page={1}
        totalPages={1}
      />
    );

    const rows = screen.getAllByRole("button", { name: /Ver detalhe do pedido/ });
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Ver detalhe do pedido de Recente",
      "Ver detalhe do pedido de Antigo",
    ]);
  });
});

describe("PedidosClient — código do pedido (ORD-35.9)", () => {
  it("mostra o código em cada linha da lista", () => {
    render(
      <PedidosClient
        orders={[
          makeOrder({ id: "o1", code: "HS0L52" }),
          makeOrder({ id: "o2", code: "MIXICD" }),
        ]}
        total={2}
        page={1}
        totalPages={1}
      />
    );

    expect(screen.getByText("HS0L52")).toBeTruthy();
    expect(screen.getByText("MIXICD")).toBeTruthy();
  });

  it("mostra o código no detalhe do pedido", () => {
    const order = makeOrder({ code: "MIXICD" });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("MIXICD")).toBeTruthy();
  });
});

describe("PedidosClient — busca por código ou nome (ORD-35.10)", () => {
  it("oferece o campo de busca quando há pedidos", () => {
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.getByLabelText("Buscar por código ou nome do cliente")).toBeTruthy();
  });

  it("leva o termo digitado para a URL, sem page, depois do debounce", () => {
    vi.useFakeTimers();
    try {
      render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

      fireEvent.change(screen.getByLabelText("Buscar por código ou nome do cliente"), {
        target: { value: " HS0L52 " },
      });
      vi.advanceTimersByTime(400);

      expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=HS0L52", { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("volta para a URL sem busca quando o campo é limpo", () => {
    vi.useFakeTimers();
    try {
      render(
        <PedidosClient
          orders={[makeOrder()]}
          total={1}
          page={1}
          totalPages={1}
          query="HS0L52"
        />
      );

      fireEvent.change(screen.getByLabelText("Buscar por código ou nome do cliente"), {
        target: { value: "" },
      });
      vi.advanceTimersByTime(400);

      expect(replace).toHaveBeenCalledWith("/painel/pedidos", { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reflete a busca vinda do servidor no campo", () => {
    render(
      <PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} query="ana" />
    );

    expect(
      (screen.getByLabelText("Buscar por código ou nome do cliente") as HTMLInputElement)
        .value
    ).toBe("ana");
  });

  it("preserva a busca nos links de paginação", () => {
    render(
      <PedidosClient
        orders={[makeOrder()]}
        total={30}
        page={1}
        totalPages={2}
        query="ana"
      />
    );

    const nav = screen.getByLabelText("Paginação");
    expect(within(nav).getByRole("link", { name: "2" }).getAttribute("href")).toBe(
      "/painel/pedidos?page=2&q=ana"
    );
  });
});

describe("PedidosClient — paginação (ORD-13)", () => {
  it("renderiza a paginação apontando para /painel/pedidos quando há mais de uma página", () => {
    render(<PedidosClient orders={[makeOrder()]} total={21} page={1} totalPages={2} />);

    const nav = screen.getByLabelText("Paginação");
    expect(
      within(nav).getByRole("link", { name: "2" }).getAttribute("href")
    ).toBe("/painel/pedidos?page=2");
  });

  it("esconde a paginação quando há uma única página", () => {
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.queryByLabelText("Paginação")).toBeNull();
  });
});

describe("PedidosClient — detalhe do pedido (ORD-14)", () => {
  it("mostra cada item com nome, tamanho, cor, quantidade, unitário e subtotal", () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Vestido midi")).toBeTruthy();
    expect(within(dialog).getByText("Tamanho M · Cor Areia")).toBeTruthy();
    expect(within(dialog).getByText("2x R$ 199,00")).toBeTruthy();
    expect(within(dialog).getByText("R$ 398,00")).toBeTruthy();
    expect(within(dialog).getByText("Blusa")).toBeTruthy();
    expect(within(dialog).getByText("1x R$ 80,00")).toBeTruthy();
    expect(within(dialog).getByText("R$ 80,00")).toBeTruthy();
  });

  it("mostra forma de pagamento e entrega com endereço quando a entrega é no endereço", () => {
    const order = makeOrder({
      deliveryMethod: "entrega",
      deliveryAddress: "Rua X, 123",
    });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Forma de pagamento: Pix")).toBeTruthy();
    expect(
      within(dialog).getByText("Entrega: Enviar no endereço — Rua X, 123")
    ).toBeTruthy();
  });

  it("mostra a entrega sem endereço quando o cliente escolheu retirada", () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Entrega: Retirar no local")).toBeTruthy();
  });

  it("mostra o total e o status do pedido no detalhe", () => {
    const order = makeOrder({ status: "confirmado" });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Total")).toBeTruthy();
    expect(within(dialog).getByText("R$ 478,00")).toBeTruthy();
    const statusBadge = within(dialog)
      .getAllByText("Confirmado")
      .find((el) => el.tagName === "SPAN");
    expect(statusBadge).toBeTruthy();
  });

  it("exibe o snapshot do item mesmo com o produto já excluído do catálogo", () => {
    const order = makeOrder({
      itemsCount: 1,
      totalCents: 12900,
      items: [
        {
          productName: "Saia plissada (produto excluído)",
          unitPriceCents: 12900,
          qty: 1,
          size: null,
          color: null,
        },
      ],
    });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Saia plissada (produto excluído)")).toBeTruthy();
    expect(within(dialog).getByText("1x R$ 129,00")).toBeTruthy();
  });
});

describe("PedidosClient — mudança de status (ORD-21, ORD-22)", () => {
  it("oferece os três status no detalhe do pedido", () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByRole("button", { name: "Pendente" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Confirmado" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Cancelado" })).toBeTruthy();
  });

  it.each(["Pendente", "Confirmado", "Cancelado"])(
    "envia o id do pedido e o status %s para a action",
    async (label) => {
      const order = makeOrder();
      render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

      const dialog = openDetail(order);
      fireEvent.click(within(dialog).getByRole("button", { name: label }));

      await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledTimes(1));
      const sent = updateOrderStatus.mock.calls[0][1] as FormData;
      expect(sent.get("id")).toBe(order.id);
      expect(sent.get("status")).toBe(label.toLowerCase());
    }
  );

  it("mostra o erro devolvido pela action sem trocar o status exibido", async () => {
    updateOrderStatus.mockResolvedValue({ error: "Pedido não encontrado." });
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Pedido não encontrado."
      )
    );
    const row = screen.getByLabelText("Ver detalhe do pedido de Ana");
    expect(within(row).getByText("Pendente")).toBeTruthy();
  });

  it("confirma a mudança com feedback de sucesso", async () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Status atualizado")
    );
  });

  it("desabilita os controles de status enquanto a mudança está em andamento", async () => {
    let finish: ((value: { ok: true }) => void) | undefined;
    updateOrderStatus.mockImplementation(
      () => new Promise<{ ok: true }>((resolve) => (finish = resolve))
    );
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancelado" })).toBeDisabled()
    );

    finish?.({ ok: true });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Cancelado" })
      ).not.toBeDisabled()
    );
  });

  it("reflete na lista o status vindo da revalidação, sem recarregar a página", async () => {
    const order = makeOrder();
    const { rerender } = render(
      <PedidosClient orders={[order]} total={1} page={1} totalPages={1} />
    );

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledTimes(1));

    rerender(
      <PedidosClient
        orders={[{ ...order, status: "confirmado" }]}
        total={1}
        page={1}
        totalPages={1}
      />
    );

    const row = screen.getByLabelText("Ver detalhe do pedido de Ana");
    expect(within(row).getByText("Confirmado")).toBeTruthy();
    expect(within(row).queryByText("Pendente")).toBeNull();
  });
});

describe("PedidosClient — estado vazio (ORD-15)", () => {
  it("explica que os pedidos aparecem quando um cliente envia a sacola", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} />);

    expect(screen.getByText("Nenhum pedido ainda")).toBeTruthy();
    expect(
      screen.getByText(
        "Quando um cliente enviar a sacola pelo WhatsApp, o pedido aparece aqui com os itens e o total."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ver detalhe do pedido/ })).toBeNull();
  });

  it("não mostra o campo de busca numa loja que ainda não tem pedido", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} />);

    expect(screen.queryByLabelText("Buscar por código ou nome do cliente")).toBeNull();
  });
});

describe("PedidosClient — estado vazio de busca (ORD-35.11)", () => {
  it("distingue busca sem resultado de loja sem nenhum pedido", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} query="ZZZZZZ" />);

    expect(screen.getByText("Nenhum pedido encontrado")).toBeTruthy();
    expect(screen.queryByText("Nenhum pedido ainda")).toBeNull();
    expect(
      screen.queryByText(
        "Quando um cliente enviar a sacola pelo WhatsApp, o pedido aparece aqui com os itens e o total."
      )
    ).toBeNull();
  });

  it("cita o termo buscado e mantém o campo de busca na tela", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} query="ZZZZZZ" />);

    expect(screen.getByText(/desta loja combina com/).textContent).toContain("ZZZZZZ");
    expect(
      (screen.getByLabelText("Buscar por código ou nome do cliente") as HTMLInputElement)
        .value
    ).toBe("ZZZZZZ");
  });
});

describe("PedidosClient — filtro de período (ORD-46)", () => {
  it("mostra o filtro de período mesmo quando a loja ainda não tem pedido", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} />);

    expect(screen.getByRole("group", { name: "Filtrar por período" })).toBeTruthy();
  });

  it("ao trocar de período, preserva a busca ativa na URL", () => {
    render(
      <PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} query="ana" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });

  it("ao buscar com um período ativo, preserva o período na URL da busca", () => {
    vi.useFakeTimers();
    try {
      render(
        <PedidosClient
          orders={[makeOrder()]}
          total={1}
          page={1}
          totalPages={1}
          periodo="hoje"
        />
      );

      fireEvent.change(screen.getByLabelText("Buscar por código ou nome do cliente"), {
        target: { value: "HS0L52" },
      });
      vi.advanceTimersByTime(400);

      expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=hoje&q=HS0L52", {
        scroll: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("mostra a paginação com período e busca combinados", () => {
    render(
      <PedidosClient
        orders={[makeOrder()]}
        total={30}
        page={1}
        totalPages={2}
        query="ana"
        periodo="hoje"
      />
    );

    const nav = screen.getByLabelText("Paginação");
    expect(within(nav).getByRole("link", { name: "2" }).getAttribute("href")).toBe(
      "/painel/pedidos?page=2&q=ana&periodo=hoje"
    );
  });

  it("mostra o subtítulo de contagem por período quando não há busca", () => {
    render(
      <PedidosClient
        orders={[makeOrder()]}
        total={5}
        page={1}
        totalPages={1}
        periodo="hoje"
      />
    );

    expect(screen.getByText("5 pedidos no período")).toBeTruthy();
  });

  it("mostra estado vazio específico quando o período filtrado não tem pedidos", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} periodo="hoje" />);

    expect(screen.getByText("Nenhum pedido no período")).toBeTruthy();
    expect(screen.getByText("Nenhum pedido no período selecionado.")).toBeTruthy();
    expect(screen.queryByText("Nenhum pedido ainda")).toBeNull();
  });

  it("prioriza o estado vazio de busca quando busca e período estão ativos ao mesmo tempo", () => {
    render(
      <PedidosClient
        orders={[]}
        total={0}
        page={1}
        totalPages={1}
        query="zzzzzz"
        periodo="hoje"
      />
    );

    expect(screen.getByText("Nenhum pedido encontrado")).toBeTruthy();
    expect(screen.getByText(/desta loja combina com/).textContent).toContain("zzzzzz");

    expect(screen.queryByText("Nenhum pedido no período")).toBeNull();
    expect(screen.queryByText("Nenhum pedido no período selecionado.")).toBeNull();
    expect(
      screen.queryByText(
        "Nenhum pedido desta loja caiu no período selecionado. Tente escolher outro período acima."
      )
    ).toBeNull();

    expect(screen.queryByText("Nenhum pedido ainda")).toBeNull();
  });
});
