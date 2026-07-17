import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import App from "./App";

// ── Module-level mocks ────────────────────────────────────────────────────

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: vi.fn(),
}));

vi.mock("./context/AppContext", () => ({
  useApp: vi.fn(),
}));

// Mock PollList so we don't need to resolve its full dependency chain
vi.mock("./components/PollList", () => ({
  PollList: vi.fn(() => <div data-testid="poll-list">Mock PollList</div>),
}));

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  WalletMultiButton: vi.fn(() => <button data-testid="wallet-button">Connect</button>),
  WalletModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useWalletModal: vi.fn(),
}));

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useApp } from "./context/AppContext";

// ── Suite ─────────────────────────────────────────────────────────────────

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApp).mockReturnValue({
      version: "v2",
      setVersion: vi.fn(),
    } as never);

    vi.mocked(useWalletModal).mockReturnValue({
      setVisible: vi.fn(),
    } as never);
  });

  it("renders the Header with 'Solana Governance'", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
    } as never);
    render(<App />);
    expect(screen.getByText("Solana Governance")).toBeInTheDocument();
  });

  it("shows LandingPage when wallet is disconnected", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: false,
    } as never);
    render(<App />);
    // LandingPage renders the hero CTA and badge
    expect(
      screen.getByRole("button", { name: /Connect Wallet to Start/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("✦ Solana Governance")).toBeInTheDocument();
  });

  it("shows PollList when wallet is connected", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: true,
      publicKey: { toBase58: () => "mock-key" },
    } as never);
    render(<App />);
    expect(screen.getByTestId("poll-list")).toBeInTheDocument();
  });
});
