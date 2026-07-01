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
});
