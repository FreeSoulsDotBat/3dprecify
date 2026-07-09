// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// US3 regression guard for the STICKY `refreshFailed` latch. The bug: gating the non-blocking notice
// on the raw `query.isError` made it blink out for the whole retry — a `refetch()` of a no-data errored
// query re-enters TanStack's 'pending' state, so isError (and isRefetching) transiently drop to false.
// We drive that exact query-state sequence by mocking `useQuery`, so the test is deterministic (no
// timers, no retry backoff) and pins the latch: raise on error, HOLD through the retry's pending
// window, lower only on success. The seams the hook also touches (idb-keyval, apiFetch) are no-oped.
const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (opts: unknown) => useQueryMock(opts) }));
vi.mock("idb-keyval", () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => undefined),
}));
vi.mock("@/shared/api/transport", () => ({ apiFetch: vi.fn() }));

import { FEE_CATALOG_SEED } from "./seed";
import { useFeeCatalog } from "./use-fee-catalog";

interface QueryStub {
  data: unknown;
  isError: boolean;
  isSuccess: boolean;
  isFetching: boolean;
  refetch: () => void;
}
function queryState(over: Partial<QueryStub> = {}): QueryStub {
  return {
    data: undefined,
    isError: false,
    isSuccess: false,
    isFetching: false,
    refetch: vi.fn(),
    ...over,
  };
}

afterEach(() => vi.clearAllMocks());

describe("useFeeCatalog — sticky refreshFailed latch (US3 regression)", () => {
  it("latches on error, HOLDS through a refetch's transient pending, clears on success", () => {
    useQueryMock.mockReturnValue(queryState());
    const { result, rerender } = renderHook(() => useFeeCatalog());
    expect(result.current.refreshFailed).toBe(false);

    // The refresh settles to an error → the latch raises.
    useQueryMock.mockReturnValue(queryState({ isError: true }));
    rerender();
    expect(result.current.refreshFailed).toBe(true);

    // Retry in flight: refetch of a no-data errored query re-enters 'pending' → isError=false,
    // isSuccess=false, isFetching=true. The latch MUST hold so the notice never blinks out.
    useQueryMock.mockReturnValue(queryState({ isFetching: true }));
    rerender();
    expect(result.current.refreshFailed).toBe(true);
    expect(result.current.refreshing).toBe(true);

    // A refresh finally succeeds → the latch lowers and the notice can hide.
    useQueryMock.mockReturnValue(queryState({ isSuccess: true, data: FEE_CATALOG_SEED }));
    rerender();
    expect(result.current.refreshFailed).toBe(false);
  });

  it("does NOT latch during the initial load (fetching, never yet errored)", () => {
    useQueryMock.mockReturnValue(queryState({ isFetching: true }));
    const { result } = renderHook(() => useFeeCatalog());
    expect(result.current.refreshFailed).toBe(false);
    expect(result.current.refreshing).toBe(true);
  });
});
