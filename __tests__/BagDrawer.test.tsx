import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BagDrawer } from "@/components/catalogo/BagDrawer";
import type { CartItem, Product } from "@/lib/types";

const product: Product = {
  id: "p1",
  name: "Vestido midi",
  price: "R$ 100,00",
  category: "Vestidos",
  image: "https://cdn.test/p1.jpg",
  desc: "",
  sizes: ["M"],
  soldSizes: [],
  colors: [{ label: "Areia", hex: "#D8C9B0" }],
};

const items: CartItem[] = [
  { key: "p1|M|Areia", product, size: "M", color: "Areia", qty: 1 },
];

function renderDrawer(props: Partial<React.ComponentProps<typeof BagDrawer>> = {}) {
  const onCheckout = vi.fn();
  render(
    <BagDrawer
      open
      items={items}
      onClose={vi.fn()}
      onQty={vi.fn()}
      onRemove={vi.fn()}
      onCheckout={onCheckout}
      {...props}
    />
  );
  return { onCheckout };
}

describe("BagDrawer — checkout (CAT-09)", () => {
  it("habilita o checkout por padrão", () => {
    const { onCheckout } = renderDrawer();
    const btn = screen.getByRole("button", { name: /Enviar pedido via WhatsApp/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it("desabilita o checkout quando canCheckout=false", () => {
    const { onCheckout } = renderDrawer({ canCheckout: false });
    const btn = screen.getByRole("button", { name: /Enviar pedido via WhatsApp/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(onCheckout).not.toHaveBeenCalled();
  });

  it("informa que a loja não configurou o WhatsApp quando canCheckout=false", () => {
    renderDrawer({ canCheckout: false });
    expect(screen.getByText(/não configurou o WhatsApp/i)).toBeTruthy();
  });

  it("não mostra o aviso quando o checkout está habilitado", () => {
    renderDrawer();
    expect(screen.queryByText(/não configurou o WhatsApp/i)).toBeNull();
  });

  it("mostra o blockedReason em vez do aviso de WhatsApp quando fornecido", () => {
    renderDrawer({
      canCheckout: false,
      blockedReason: "Selecione forma de pagamento e entrega para continuar.",
    });
    expect(
      screen.getByText("Selecione forma de pagamento e entrega para continuar.")
    ).toBeTruthy();
    expect(screen.queryByText(/não configurou o WhatsApp/i)).toBeNull();
  });
});

describe("BagDrawer — pagamento e entrega (novo)", () => {
  it("não mostra seletor de pagamento quando a loja não configurou nenhuma forma", () => {
    renderDrawer({ paymentMethods: [] });
    expect(screen.queryByText("Forma de pagamento")).toBeNull();
  });

  it("mostra as opções de pagamento configuradas, nenhuma pré-selecionada", () => {
    renderDrawer({ paymentMethods: ["pix", "cartao"], selectedPayment: null });
    const pix = screen.getByRole("button", { name: "Pix" });
    const cartao = screen.getByRole("button", { name: "Cartão" });
    expect(pix.className).not.toContain("text-white");
    expect(cartao.className).not.toContain("text-white");
  });

  it("aciona onSelectPayment ao clicar em uma opção", () => {
    const onSelectPayment = vi.fn();
    renderDrawer({ paymentMethods: ["pix", "cartao"], onSelectPayment });
    fireEvent.click(screen.getByRole("button", { name: "Pix" }));
    expect(onSelectPayment).toHaveBeenCalledWith("pix");
  });

  it("não mostra seletor de entrega quando a loja não configurou nenhuma forma", () => {
    renderDrawer({ deliveryMethods: [] });
    expect(screen.queryByText("Entrega")).toBeNull();
  });

  it("mostra o campo de endereço somente quando 'entrega' está selecionada", () => {
    const { rerender } = render(
      <BagDrawer
        open
        items={items}
        deliveryMethods={["retirada", "entrega"]}
        selectedDelivery="retirada"
        onClose={vi.fn()}
        onQty={vi.fn()}
        onRemove={vi.fn()}
        onCheckout={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/Endereço completo/i)).toBeNull();

    rerender(
      <BagDrawer
        open
        items={items}
        deliveryMethods={["retirada", "entrega"]}
        selectedDelivery="entrega"
        onClose={vi.fn()}
        onQty={vi.fn()}
        onRemove={vi.fn()}
        onCheckout={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Endereço completo/i)).toBeTruthy();
  });

  it("aciona onAddressChange ao digitar no campo de endereço", () => {
    const onAddressChange = vi.fn();
    renderDrawer({
      deliveryMethods: ["retirada", "entrega"],
      selectedDelivery: "entrega",
      onAddressChange,
    });
    fireEvent.change(screen.getByLabelText(/Endereço completo/i), {
      target: { value: "Rua X, 123" },
    });
    expect(onAddressChange).toHaveBeenCalledWith("Rua X, 123");
  });
});
