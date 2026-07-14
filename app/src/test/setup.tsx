import "@testing-library/jest-dom";

// Block real wallet adapters from instantiating in jsdom
vi.mock("@solana/wallet-adapter-wallets", () => ({
  PhantomWalletAdapter: vi.fn(),
  SolflareWalletAdapter: vi.fn(),
  CoinbaseWalletAdapter: vi.fn(),
}));

// Block WalletMultiButton from real rendering
vi.mock("@solana/wallet-adapter-react-ui", () => ({
  WalletMultiButton: vi.fn(() => <button data-testid="wallet-button">Connect</button>),
  WalletModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
