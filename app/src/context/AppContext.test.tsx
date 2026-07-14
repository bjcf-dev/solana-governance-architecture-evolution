import { describe, it, expect, vi, beforeEach, type Mocked } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { PublicKey } from "@solana/web3.js";
import { AppContextProvider, useApp } from "./AppContext";

// ── Module-level mocks ────────────────────────────────────────────────────
// useWallet is called inside AppContextProvider — mock it to control
// connected / disconnected states.

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: vi.fn(),
}));

import { useWallet } from "@solana/wallet-adapter-react";

type WalletMock = Mocked<ReturnType<typeof useWallet>>;

// ── Suite ─────────────────────────────────────────────────────────────────

describe("AppContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Provider wraps children ────────────────────────────────────────────

  it("provides context to children", () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: new PublicKey("11111111111111111111111111111111"),
      connected: true,
    } as WalletMock);

    const { result } = renderHook(() => useApp(), {
      wrapper: AppContextProvider,
    });

    expect(result.current).toBeDefined();
  });

  // ── Default version ────────────────────────────────────────────────────

  it("defaults version to 'v2'", () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: new PublicKey("11111111111111111111111111111111"),
      connected: true,
    } as WalletMock);

    const { result } = renderHook(() => useApp(), {
      wrapper: AppContextProvider,
    });

    expect(result.current.version).toBe("v2");
  });

  // ── setVersion ─────────────────────────────────────────────────────────

  it("setVersion updates the version", () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: new PublicKey("11111111111111111111111111111111"),
      connected: true,
    } as WalletMock);

    const { result } = renderHook(() => useApp(), {
      wrapper: AppContextProvider,
    });

    act(() => {
      result.current.setVersion("v3");
    });

    expect(result.current.version).toBe("v3");
  });

  it("setVersion can switch to any valid version", () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: new PublicKey("11111111111111111111111111111111"),
      connected: true,
    } as WalletMock);

    const { result } = renderHook(() => useApp(), {
      wrapper: AppContextProvider,
    });

    act(() => { result.current.setVersion("v1"); });
    expect(result.current.version).toBe("v1");

    act(() => { result.current.setVersion("v2"); });
    expect(result.current.version).toBe("v2");

    act(() => { result.current.setVersion("v3"); });
    expect(result.current.version).toBe("v3");
  });

  // ── program null when wallet not connected ─────────────────────────────

  it("returns null program when wallet publicKey is null", () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      connected: false,
    } as WalletMock);

    const { result } = renderHook(() => useApp(), {
      wrapper: AppContextProvider,
    });

    expect(result.current.program).toBeNull();
  });

  it("all programs are null when wallet publicKey is null", () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      connected: false,
    } as WalletMock);

    const { result } = renderHook(() => useApp(), {
      wrapper: AppContextProvider,
    });

    expect(result.current.programs.v1).toBeNull();
    expect(result.current.programs.v2).toBeNull();
    expect(result.current.programs.v3).toBeNull();
  });

  // ── useApp throws outside provider ─────────────────────────────────────

  it("throws when useApp is called outside AppContextProvider", () => {
    // Suppress console.error from the caught error boundary
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useApp())).toThrow(
      "useApp must be used within AppContextProvider",
    );

    spy.mockRestore();
  });

  // ── connection is always defined ───────────────────────────────────────

  it("provides a connection instance regardless of wallet state", () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      connected: false,
    } as WalletMock);

    const { result } = renderHook(() => useApp(), {
      wrapper: AppContextProvider,
    });

    expect(result.current.connection).toBeDefined();
  });
});
