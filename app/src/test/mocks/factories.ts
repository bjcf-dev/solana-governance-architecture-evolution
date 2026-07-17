import { vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import type { VersionId } from "../../config/versions";
import type { VersionConfig } from "../../config/versions";
import { getVersion } from "../../config/versions";

// ── Wallet mock ──────────────────────────────────────────────────────────────

export interface MockWallet {
  publicKey: PublicKey;
  signTransaction: ReturnType<typeof vi.fn>;
  signAllTransactions: ReturnType<typeof vi.fn>;
  sendTransaction: ReturnType<typeof vi.fn>;
}

export function createMockWallet(overrides?: Partial<MockWallet>): MockWallet {
  return {
    publicKey: new PublicKey("11111111111111111111111111111111"),
    signTransaction: vi.fn(),
    signAllTransactions: vi.fn(),
    sendTransaction: vi.fn().mockResolvedValue("mock-signature-xyz"),
    ...overrides,
  };
}

// ── Connection mock ──────────────────────────────────────────────────────────

export interface MockConnection {
  getAccountInfo: ReturnType<typeof vi.fn>;
  getTokenAccountsByOwner: ReturnType<typeof vi.fn>;
  confirmTransaction: ReturnType<typeof vi.fn>;
}

export function createMockConnection(
  accounts?: Map<string, unknown>
): MockConnection {
  return {
    getAccountInfo: vi
      .fn()
      .mockImplementation(async (key: PublicKey) =>
        accounts?.get(key.toBase58()) ?? null
      ),
    getTokenAccountsByOwner: vi
      .fn()
      .mockResolvedValue({ value: [{ pubkey: new PublicKey("11111111111111111111111111111111") }] }),
    confirmTransaction: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Program mock ─────────────────────────────────────────────────────────────

interface MockInstruction {
  instruction: ReturnType<typeof vi.fn>;
  accounts: ReturnType<typeof vi.fn>;
}

interface MockMethods {
  vote: ReturnType<typeof vi.fn>;
  withdrawTokens: ReturnType<typeof vi.fn>;
  closePoll: ReturnType<typeof vi.fn>;
}

export interface MockProgram {
  methods: MockMethods;
  coder: { accounts: { decode: ReturnType<typeof vi.fn> } };
}

export function createMockProgram(
  options: { version: VersionId }
): MockProgram {
  const config: VersionConfig = getVersion(options.version);

  const makeChainable = () => {
    const chain: MockInstruction = {
      accounts: vi.fn().mockReturnThis(),
      instruction: vi.fn().mockResolvedValue({
        keys: [],
        programId: config.programId,
        data: Buffer.from([]),
      }),
    };
    // Return a function that returns the chainable mock
    const fn = vi.fn(() => chain);
    // Attach chainable methods to the function itself so `.vote.accounts()` works
    Object.assign(fn, chain);
    return fn as unknown as ReturnType<typeof vi.fn> & MockInstruction;
  };

  return {
    methods: {
      vote: makeChainable(),
      withdrawTokens: makeChainable(),
      closePoll: makeChainable(),
    },
    coder: {
      accounts: {
        decode: vi.fn(),
      },
    },
  };
}
