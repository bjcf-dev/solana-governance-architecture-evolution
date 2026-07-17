import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render, fireEvent } from "@testing-library/react";
import { LandingPage } from "./LandingPage";

// Module-level mocks — useWallet and useWalletModal are also exposed
// via setup.tsx; we re-mock here for explicit control in this test file.
vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@solana/wallet-adapter-react-ui", () => ({
  useWalletModal: vi.fn(),
  WalletMultiButton: vi.fn(() => <button data-testid="wallet-button">Connect</button>),
  WalletModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

// ── Suite ─────────────────────────────────────────────────────────────────

describe("LandingPage", () => {
  let mockSetVisible: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetVisible = vi.fn();

    vi.mocked(useWallet).mockReturnValue({
      connected: false,
    } as never);

    vi.mocked(useWalletModal).mockReturnValue({
      setVisible: mockSetVisible,
    } as never);
  });

  function renderPage() {
    return render(<LandingPage />);
  }

  // ── Badge ────────────────────────────────────────────────────────────────

  it("renders the 'Solana Governance' badge", () => {
    renderPage();
    expect(screen.getByText("✦ Solana Governance")).toBeInTheDocument();
  });

  // ── Title ────────────────────────────────────────────────────────────────

  it("renders the 'Shape the Protocol' heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Shape the Protocol/i })).toBeInTheDocument();
  });

  // ── Subtitle ─────────────────────────────────────────────────────────────

  it("renders the subtitle description", () => {
    renderPage();
    expect(
      screen.getByText(/Every token holder has a voice in the future of the DAO/),
    ).toBeInTheDocument();
  });

  // ── CTA button ───────────────────────────────────────────────────────────

  it("renders the 'Connect Wallet to Start' CTA button", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /Connect Wallet to Start/i }),
    ).toBeInTheDocument();
  });

  it("opens the wallet modal when CTA button is clicked", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Connect Wallet to Start/i }));
    expect(mockSetVisible).toHaveBeenCalledWith(true);
  });

  it("still renders when wallet is already connected (defensive)", () => {
    vi.mocked(useWallet).mockReturnValue({
      connected: true,
    } as never);
    renderPage();
    // Component doesn't gate on connected — it always renders the hero
    expect(screen.getByText("✦ Solana Governance")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Connect Wallet to Start/i }),
    ).toBeInTheDocument();
  });

  // ── Feature cards ────────────────────────────────────────────────────────

  it("renders the 'On-Chain Voting' feature card", () => {
    renderPage();
    expect(screen.getByText("On-Chain Voting")).toBeInTheDocument();
  });

  it("renders the 'Token-Gated' feature card", () => {
    renderPage();
    expect(screen.getByText("Token-Gated")).toBeInTheDocument();
  });

  it("renders the 'Live Results' feature card", () => {
    renderPage();
    expect(screen.getByText("Live Results")).toBeInTheDocument();
  });

  it("renders descriptions for all three feature cards", () => {
    renderPage();
    expect(
      screen.getByText(/Every vote is recorded on Solana/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Voting power scales with your stake/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Real-time tally as votes come in/),
    ).toBeInTheDocument();
  });
});
