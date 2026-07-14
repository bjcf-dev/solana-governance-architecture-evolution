import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVote } from "./useVote";

// ── Module-level mocks (hoisted by vitest before any imports) ─────────────────

vi.mock("../context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("@solana/wallet-adapter-react", () => ({
  useWallet: vi.fn(),
}));

vi.mock("../utils/pda", () => ({
  derivePollPda: vi.fn(),
  deriveCandidatePda: vi.fn(),
  deriveVoteRecordPda: vi.fn(),
  deriveEscrowPda: vi.fn(),
}));

import { useApp } from "../context/AppContext";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  derivePollPda,
  deriveCandidatePda,
  deriveVoteRecordPda,
  deriveEscrowPda,
} from "../utils/pda";

// ── Mock builders ────────────────────────────────────────────────────────────

function createMethodChain() {
  const instruction = vi
    .fn()
    .mockResolvedValue({ keys: [], programId: "mock", data: new Uint8Array(0) });
  const accounts = vi.fn().mockReturnValue({ instruction });
  const method = vi.fn(() => ({ accounts }));
  return { method, accounts, instruction };
}

function createMockWallet(overrides?: Record<string, unknown>) {
  return {
    publicKey: { toBytes: () => new Uint8Array(32), toBase58: () => "mock-user" },
    signTransaction: vi.fn(),
    sendTransaction: vi.fn().mockResolvedValue("mock-sig"),
    ...overrides,
  };
}

function makePdaObject(base58 = "mock-pda") {
  return { toBase58: () => base58 };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("useVote", () => {
  let wallet: ReturnType<typeof createMockWallet>;
  let connection: {
    getTokenAccountsByOwner: ReturnType<typeof vi.fn>;
    confirmTransaction: ReturnType<typeof vi.fn>;
  };
  let voteChain: ReturnType<typeof createMethodChain>;
  let withdrawChain: ReturnType<typeof createMethodChain>;
  let closeChain: ReturnType<typeof createMethodChain>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Wallet
    wallet = createMockWallet();
    vi.mocked(useWallet).mockReturnValue(wallet as never);

    // Program method chains
    voteChain = createMethodChain();
    withdrawChain = createMethodChain();
    closeChain = createMethodChain();

    const mockProgram = {
      methods: {
        vote: voteChain.method,
        withdrawTokens: withdrawChain.method,
        closePoll: closeChain.method,
      },
    };

    // Connection
    connection = {
      getTokenAccountsByOwner: vi
        .fn()
        .mockResolvedValue({
          value: [
            { pubkey: makePdaObject("mock-token-account") },
          ],
        }),
      confirmTransaction: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(useApp).mockReturnValue({
      version: "v2",
      programs: { v1: mockProgram, v2: mockProgram, v3: mockProgram } as never,
      connection: connection as never,
      program: mockProgram as never,
    });

    // PDA derivation mocks — deterministic fake addresses
    vi.mocked(derivePollPda).mockReturnValue([makePdaObject("poll-pda"), 255] as never);
    vi.mocked(deriveCandidatePda).mockReturnValue([makePdaObject("cand-pda"), 254] as never);
    vi.mocked(deriveVoteRecordPda).mockReturnValue([makePdaObject("vote-pda"), 253] as never);
    vi.mocked(deriveEscrowPda).mockReturnValue([makePdaObject("escrow-pda"), 252] as never);
  });

  // ── Not connected ───────────────────────────────────────────────────────

  it("vote throws when wallet is not connected", async () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      signTransaction: undefined,
      sendTransaction: undefined,
    } as never);

    const { result } = renderHook(() => useVote());
    await expect(result.current.vote({ pollId: 1, candidate: "Alice" })).rejects.toThrow(
      "Wallet not connected",
    );
  });

  it("withdraw throws when wallet is not connected", async () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      signTransaction: undefined,
      sendTransaction: undefined,
    } as never);

    const { result } = renderHook(() => useVote());
    await expect(result.current.withdraw(1)).rejects.toThrow("Wallet not connected");
  });

  it("closePoll throws when wallet is not connected", async () => {
    vi.mocked(useWallet).mockReturnValue({
      publicKey: null,
      signTransaction: undefined,
      sendTransaction: undefined,
    } as never);

    const { result } = renderHook(() => useVote());
    await expect(result.current.closePoll(1)).rejects.toThrow("Wallet not connected");
  });

  // ── Vote V1 ─────────────────────────────────────────────────────────────

  it("vote with V1 calls program.methods.vote with correct accounts", async () => {
    const { result } = renderHook(() => useVote("v1"));

    const sig = await result.current.vote({ pollId: 1, candidate: "Alice" });

    expect(sig).toBe("mock-sig");
    expect(derivePollPda).toHaveBeenCalled();
    expect(deriveCandidatePda).toHaveBeenCalledWith(
      expect.objectContaining({ id: "v1" }),
      1,
      "Alice",
    );
    expect(deriveVoteRecordPda).toHaveBeenCalled();
    // V1 vote takes 2 args: (pollId, candidate)
    expect(voteChain.method).toHaveBeenCalledWith(1, "Alice");
    expect(voteChain.accounts).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ toBase58: expect.any(Function) }),
        pollAccount: expect.objectContaining({ toBase58: expect.any(Function) }),
        candidateAccount: expect.objectContaining({ toBase58: expect.any(Function) }),
        voteRecord: expect.objectContaining({ toBase58: expect.any(Function) }),
      }),
    );
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(connection.confirmTransaction).toHaveBeenCalledWith("mock-sig", "confirmed");
  });

  // ── Vote V2 ─────────────────────────────────────────────────────────────

  it("vote with V2 includes token and escrow accounts", async () => {
    const { result } = renderHook(() => useVote("v2"));

    const sig = await result.current.vote({ pollId: 1, candidate: "Alice", amount: 100 });

    expect(sig).toBe("mock-sig");
    expect(connection.getTokenAccountsByOwner).toHaveBeenCalledWith(
      expect.objectContaining({ toBase58: expect.any(Function) }),
      expect.objectContaining({ mint: expect.anything() }),
    );
    // V2 vote takes 3 args: (pollId, candidate, amount)
    expect(voteChain.method).toHaveBeenCalledWith(1, "Alice", 100);
    expect(voteChain.accounts).toHaveBeenCalledWith(
      expect.objectContaining({
        userTokenAccount: expect.objectContaining({ toBase58: expect.any(Function) }),
        escrowVault: expect.objectContaining({ toBase58: expect.any(Function) }),
        tokenProgram: expect.anything(),
      }),
    );
  });

  it("vote with V2 throws when no governance token found", async () => {
    connection.getTokenAccountsByOwner.mockResolvedValue({ value: [] });

    const { result } = renderHook(() => useVote("v2"));
    await expect(
      result.current.vote({ pollId: 1, candidate: "Alice", amount: 100 }),
    ).rejects.toThrow("No governance token found");
  });

  it("vote with V2 uses default amount 0 when amount is omitted", async () => {
    const { result } = renderHook(() => useVote("v2"));

    await result.current.vote({ pollId: 1, candidate: "Alice" });

    // The hook does: amount ?? 0 for V2
    expect(voteChain.method).toHaveBeenCalledWith(1, "Alice", 0);
  });

  // ── Vote V3 ─────────────────────────────────────────────────────────────

  it("vote with V3 includes merkle proof when proof is provided", async () => {
    const { result } = renderHook(() => useVote("v3"));

    const proof: Uint8Array[] = [new Uint8Array(32)];
    const sig = await result.current.vote({
      pollId: 1,
      candidate: "Alice",
      amount: 1,
      proof,
      leafIndex: 0,
    });

    expect(sig).toBe("mock-sig");
    // V3 vote takes 5 args: (pollId, candidate, amount, proof, leafIndex)
    expect(voteChain.method).toHaveBeenCalledWith(1, "Alice", 1, proof, 0);
    expect(voteChain.accounts).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.anything(),
        pollAccount: expect.anything(),
        candidateAccount: expect.anything(),
        systemProgram: expect.anything(),
      }),
    );
    // V3 should NOT have voteRecord or escrow accounts
    const accountsArg = voteChain.accounts.mock.calls[0][0];
    expect(accountsArg).not.toHaveProperty("voteRecord");
    expect(accountsArg).not.toHaveProperty("escrowVault");
    expect(accountsArg).not.toHaveProperty("userTokenAccount");
  });

  it("vote with V3 uses default amount 1 when omitted", async () => {
    const { result } = renderHook(() => useVote("v3"));

    await result.current.vote({
      pollId: 1,
      candidate: "Alice",
      proof: [new Uint8Array(32)],
      leafIndex: 0,
    });

    // V3 does: amount ?? 1
    expect(voteChain.method).toHaveBeenCalledWith(1, "Alice", 1, expect.any(Array), 0);
  });

  // ── Withdraw ────────────────────────────────────────────────────────────

  it("withdraw throws for V1 (non-V2 version)", async () => {
    const { result } = renderHook(() => useVote("v1"));
    await expect(result.current.withdraw(1)).rejects.toThrow("Withdraw only available for V2");
  });

  it("withdraw throws for V3 (non-V2 version)", async () => {
    const { result } = renderHook(() => useVote("v3"));
    await expect(result.current.withdraw(1)).rejects.toThrow("Withdraw only available for V2");
  });

  it("withdraw with V2 calls program.methods.withdrawTokens", async () => {
    const { result } = renderHook(() => useVote("v2"));

    const sig = await result.current.withdraw(1);

    expect(sig).toBe("mock-sig");
    expect(withdrawChain.method).toHaveBeenCalledWith(1);
    expect(withdrawChain.accounts).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.anything(),
        pollAccount: expect.anything(),
        voteRecord: expect.anything(),
        escrowVault: expect.anything(),
        userTokenAccount: expect.anything(),
        tokenProgram: expect.anything(),
      }),
    );
    expect(connection.getTokenAccountsByOwner).toHaveBeenCalled();
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
  });

  it("withdraw V2 throws when no token account found", async () => {
    connection.getTokenAccountsByOwner.mockResolvedValue({ value: [] });

    const { result } = renderHook(() => useVote("v2"));
    await expect(result.current.withdraw(1)).rejects.toThrow("No token account");
  });

  // ── closePoll ───────────────────────────────────────────────────────────

  it("closePoll sends and confirms transaction", async () => {
    const { result } = renderHook(() => useVote("v2"));

    const sig = await result.current.closePoll(1);

    expect(sig).toBe("mock-sig");
    expect(closeChain.method).toHaveBeenCalledWith(1);
    expect(closeChain.accounts).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.anything(),
        pollAccount: expect.anything(),
      }),
    );
    expect(wallet.sendTransaction).toHaveBeenCalledOnce();
    expect(connection.confirmTransaction).toHaveBeenCalledWith("mock-sig", "confirmed");
  });

  // ── Version from context ────────────────────────────────────────────────

  it("uses version from context when no version arg passed", async () => {
    const { result } = renderHook(() => useVote());
    // Context defaults to "v2" in beforeEach
    await result.current.vote({ pollId: 1, candidate: "Alice" });

    // V2 vote called with amount default 0
    expect(voteChain.method).toHaveBeenCalledWith(1, "Alice", 0);
  });
});
