import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCookieConsent } from "@/components/analytics/use-cookie-consent";

beforeEach(() => {
  window.localStorage.clear();
});

describe("useCookieConsent", () => {
  it("começa sem decisão quando localStorage está vazio", () => {
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current.hydrated).toBe(true);
    expect(result.current.consent).toBeNull();
  });

  it("lê uma decisão já salva no localStorage", () => {
    window.localStorage.setItem("cookie-consent", "accepted");
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current.consent).toBe("accepted");
  });

  it("accept() persiste e atualiza o estado", () => {
    const { result } = renderHook(() => useCookieConsent());
    act(() => result.current.accept());
    expect(result.current.consent).toBe("accepted");
    expect(window.localStorage.getItem("cookie-consent")).toBe("accepted");
  });

  it("reject() persiste e atualiza o estado", () => {
    const { result } = renderHook(() => useCookieConsent());
    act(() => result.current.reject());
    expect(result.current.consent).toBe("rejected");
    expect(window.localStorage.getItem("cookie-consent")).toBe("rejected");
  });

  it("ignora valor corrompido no localStorage e mantém sem decisão", () => {
    window.localStorage.setItem("cookie-consent", "algo-invalido");
    const { result } = renderHook(() => useCookieConsent());
    expect(result.current.consent).toBeNull();
  });
});
