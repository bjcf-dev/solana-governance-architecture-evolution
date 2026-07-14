import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render, fireEvent } from "@testing-library/react";
import { Header } from "./Header";
import { VERSIONS } from "../config/versions";

// ── Module-level mocks (hoisted by vitest before imports) ─────────────────

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: vi.fn(),
}));

vi.mock("../context/AppContext", () => ({
  useApp: vi.fn(),
}));

import { useWallet } from "@solana/wallet-adapter-react";
import { useApp } from "../context/AppContext";

// ── Suite ─────────────────────────────────────────────────────────────────

describe("Header", () => {
  let mockSetVersion: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetVersion = vi.fn();

    // Default: wallet connected
    vi.mocked(useWallet).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => "mock-key" },
    } as never);

    vi.mocked(useApp).mockReturnValue({
      version: "v2",
      setVersion: mockSetVersion,
    } as never);
  });

  function renderHeader() {
    return render(<Header />);
  }

  // ── Title ───────────────────────────────────────────────────────────────

  it("renders 'Solana Governance' title", () => {
    renderHeader();
    expect(screen.getByText("Solana Governance")).toBeInTheDocument();
  });

  // ── Wallet button ───────────────────────────────────────────────────────

  it("renders wallet button", () => {
    renderHeader();
    // WalletMultiButton is mocked in setup.tsx to render a button with data-testid="wallet-button"
    expect(screen.getByTestId("wallet-button")).toBeInTheDocument();
  });

  // ── Version selector ────────────────────────────────────────────────────

  it("shows version selector dropdown with all version options", () => {
    renderHeader();
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(VERSIONS.length);

    VERSIONS.forEach((v) => {
      expect(screen.getByText(v.label)).toBeInTheDocument();
    });
  });

  it("changing version selector calls setVersion", () => {
    renderHeader();
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "v3" } });
    expect(mockSetVersion).toHaveBeenCalledWith("v3");
  });

  it("selects the current version from context", () => {
    renderHeader();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("v2");
  });

  // ── Connection prompt ───────────────────────────────────────────────────

  it("shows connection prompt when wallet is NOT connected", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
      publicKey: null,
    } as never);

    renderHeader();
    expect(
      screen.getByText("Connect your wallet to interact with polls"),
    ).toBeInTheDocument();
  });

  it("hides connection prompt when wallet is connected", () => {
    renderHeader(); // connected = true (default)
    expect(
      screen.queryByText("Connect your wallet to interact with polls"),
    ).not.toBeInTheDocument();
  });
});
