import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PedidosClient } from "@/app/painel/pedidos/PedidosClient";
import type { StoreOrder } from "@/lib/types";

function makeOrder(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: "o1",
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
    expect(within(dialog).getByText("Confirmado")).toBeTruthy();
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
});
