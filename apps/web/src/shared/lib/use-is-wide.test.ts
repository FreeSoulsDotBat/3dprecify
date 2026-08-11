// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { installMatchMedia, VIEWPORT } from "./match-media.test-helper";
import { useIsWide } from "./use-is-wide";

// 018/T004 — o gate de largura (ADR-0031). O caso mais importante deste arquivo é o PRIMEIRO:
// sem `matchMedia`, a resposta é `false`. É essa resposta que mantém a suíte inteira do app
// exercitando o ramo mobile sem que ninguém precise se lembrar disso.

describe("useIsWide", () => {
  let handle: ReturnType<typeof installMatchMedia> | null = null;
  afterEach(() => {
    handle?.restore();
    handle = null;
  });

  it("responde false quando matchMedia não existe (jsdom puro = ramo mobile intocado)", () => {
    const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
    delete (window as Partial<Window>).matchMedia;
    try {
      const { result } = renderHook(() => useIsWide());
      expect(result.current).toBe(false);
    } finally {
      if (original) Object.defineProperty(window, "matchMedia", original);
    }
  });

  it("responde true a partir de 1280px", () => {
    handle = installMatchMedia(VIEWPORT.desktop);
    const { result } = renderHook(() => useIsWide());
    expect(result.current).toBe(true);
  });

  it("responde false a 1279px — o pixel que prova o corte", () => {
    handle = installMatchMedia(VIEWPORT.belowCut);
    const { result } = renderHook(() => useIsWide());
    expect(result.current).toBe(false);
  });

  it("responde false no mobile homologado", () => {
    handle = installMatchMedia(VIEWPORT.mobile);
    const { result } = renderHook(() => useIsWide());
    expect(result.current).toBe(false);
  });

  it("acompanha a mudança de largura nos dois sentidos", () => {
    handle = installMatchMedia(VIEWPORT.mobile);
    const { result } = renderHook(() => useIsWide());
    expect(result.current).toBe(false);

    act(() => handle?.setWidth(VIEWPORT.desktopLarge));
    expect(result.current).toBe(true);

    act(() => handle?.setWidth(VIEWPORT.belowCut));
    expect(result.current).toBe(false);
  });

  it("solta o listener ao desmontar (um resize depois não pode atualizar um hook morto)", () => {
    handle = installMatchMedia(VIEWPORT.mobile);
    const { result, unmount } = renderHook(() => useIsWide());
    unmount();
    act(() => handle?.setWidth(VIEWPORT.desktopLarge));
    expect(result.current).toBe(false);
  });
});
