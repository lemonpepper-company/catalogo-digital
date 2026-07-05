import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLojaFields } from "@/components/loja/use-loja-fields";

vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (f: File) => f),
}));

const baseInit = {
  whatsapp: null,
  monogram: null,
  storeDescription: null,
  instagram: null,
  accentColor: "#C9A96E",
  paymentMethods: [],
  deliveryMethods: [],
};

beforeEach(() => {
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLojaFields", () => {
  it("inicializa com valores vazios quando init não tem valores", () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    expect(result.current.whatsapp).toBe("");
    expect(result.current.monogram).toBe("");
    expect(result.current.storeDescription).toBe("");
    expect(result.current.instagram).toBe("");
    expect(result.current.accent).toBe("#C9A96E");
    expect(result.current.paymentMethods).toEqual([]);
    expect(result.current.deliveryMethods).toEqual([]);
    expect(result.current.logo).toBeNull();
    expect(result.current.logoPreview).toBeNull();
  });

  it("inicializa com os valores fornecidos quando presentes", () => {
    const { result } = renderHook(() =>
      useLojaFields({
        whatsapp: "5511999990000",
        monogram: "AM",
        storeDescription: "Vitrine premium",
        instagram: "atelieming",
        accentColor: "#000000",
        paymentMethods: ["pix"],
        deliveryMethods: ["retirada"],
      })
    );
    expect(result.current.whatsapp).toBe("5511999990000");
    expect(result.current.monogram).toBe("AM");
    expect(result.current.storeDescription).toBe("Vitrine premium");
    expect(result.current.instagram).toBe("atelieming");
    expect(result.current.accent).toBe("#000000");
    expect(result.current.paymentMethods).toEqual(["pix"]);
    expect(result.current.deliveryMethods).toEqual(["retirada"]);
  });

  it("togglePaymentMethod adiciona e remove valores", () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    act(() => result.current.togglePaymentMethod("pix"));
    expect(result.current.paymentMethods).toEqual(["pix"]);
    act(() => result.current.togglePaymentMethod("pix"));
    expect(result.current.paymentMethods).toEqual([]);
  });

  it("toggleDeliveryMethod adiciona e remove valores", () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    act(() => result.current.toggleDeliveryMethod("retirada"));
    expect(result.current.deliveryMethods).toEqual(["retirada"]);
    act(() => result.current.toggleDeliveryMethod("retirada"));
    expect(result.current.deliveryMethods).toEqual([]);
  });

  it("setLogo comprime a imagem e gera uma preview", async () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    const file = new File(["conteudo"], "logo.png", { type: "image/png" });
    await act(async () => {
      await result.current.setLogo(file);
    });
    expect(result.current.logo).toBe(file);
    expect(result.current.logoPreview).toBe("blob:mock-url");
  });

  it("setLogo(null) limpa o arquivo e a preview", async () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    const file = new File(["conteudo"], "logo.png", { type: "image/png" });
    await act(async () => {
      await result.current.setLogo(file);
    });
    await act(async () => {
      await result.current.setLogo(null);
    });
    expect(result.current.logo).toBeNull();
    expect(result.current.logoPreview).toBeNull();
  });
});
