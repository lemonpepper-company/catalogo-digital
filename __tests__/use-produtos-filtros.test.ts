import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProdutosFiltros } from "@/app/painel/produtos/use-produtos-filtros";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("useProdutosFiltros", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não chama router.replace imediatamente ao digitar", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onQChange("vestido"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("chama router.replace com ?q= após o debounce de 400ms", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onQChange("vestido"));
    act(() => vi.advanceTimersByTime(400));
    expect(replace).toHaveBeenCalledWith("/painel/produtos?q=vestido", {
      scroll: false,
    });
  });

  it("cancela o debounce anterior se o usuário digitar de novo antes de 400ms", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onQChange("ves"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onQChange("vestido"));
    act(() => vi.advanceTimersByTime(400));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/painel/produtos?q=vestido", {
      scroll: false,
    });
  });

  it("aplica o filtro de categoria imediatamente, sem esperar debounce", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onCategoriaChange("cat-1"));
    expect(replace).toHaveBeenCalledWith("/painel/produtos?categoria=cat-1", {
      scroll: false,
    });
  });

  it("aplica o filtro de status imediatamente, sem esperar debounce", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onStatusChange("ativo"));
    expect(replace).toHaveBeenCalledWith("/painel/produtos?status=ativo", {
      scroll: false,
    });
  });

  it("combina q, categoria e status na mesma URL", () => {
    const { result } = renderHook(() =>
      useProdutosFiltros("vestido", "cat-1", "")
    );
    act(() => result.current.onStatusChange("ativo"));
    expect(replace).toHaveBeenCalledWith(
      "/painel/produtos?q=vestido&categoria=cat-1&status=ativo",
      { scroll: false }
    );
  });

  it("clearFilters limpa a URL e o estado local de busca", () => {
    const { result } = renderHook(() =>
      useProdutosFiltros("vestido", "cat-1", "ativo")
    );
    act(() => result.current.clearFilters());
    expect(replace).toHaveBeenCalledWith("/painel/produtos", {
      scroll: false,
    });
    expect(result.current.q).toBe("");
  });

  it("não reverte categoria escolhida quando o debounce de busca dispara depois", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onCategoriaChange("cat-1"));
    act(() => result.current.onQChange("vestido"));
    act(() => vi.advanceTimersByTime(400));
    expect(replace).toHaveBeenLastCalledWith(
      "/painel/produtos?q=vestido&categoria=cat-1",
      { scroll: false }
    );
  });
});
