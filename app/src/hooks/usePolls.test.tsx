import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePolls } from "./usePolls";
import type { MockProgram } from "../test/mocks/factories";

// ── Module-level mocks ───────────────────────────────────────────────────────
// These are hoisted by vitest before any imports.

vi.mock("../context/AppContext", () => ({
  useApp: vi.fn(),
}));

vi.mock("../utils/pda", () => ({
  derivePollPda: vi.fn(),
  deriveCandidatePda: vi.fn(),
}));

vi.mock("../data/demo-polls", () => ({
  DEMO_POLLS: {},
}));

import { useApp } from "../context/AppContext";
import { derivePollPda, deriveCandidatePda } from "../utils/pda";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockPollDecode(overrides?: Record<string, unknown>) {
  return {
    pollName: "Test Poll",
    description: "A poll for testing",
    votingStart: 1000,
    votingEnd: 2000,
    closed: false,
    candidates: "Alice,Bob",
    ...overrides,
  };
}

function createMockCandidateDecode(overrides?: Record<string, unknown>) {
  return {
    candidateName: "Alice",
    candidateVotes: BigInt(42),
    ...overrides,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("usePolls", () => {
  let mockGetAccountInfo: ReturnType<typeof vi.fn>;
  let mockDecode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAccountInfo = vi.fn();
    mockDecode = vi.fn();

    const mockProgram: MockProgram = {
      methods: {} as MockProgram["methods"],
      coder: {
        accounts: { decode: mockDecode },
      },
    } as unknown as MockProgram;

    vi.mocked(useApp).mockReturnValue({
      version: "v2",
      programs: { v1: null, v2: mockProgram as never, v3: null },
      connection: { getAccountInfo: mockGetAccountInfo } as never,
      program: mockProgram as never,
    });

    // Map poll IDs to deterministic fake PDAs
    vi.mocked(derivePollPda).mockImplementation(
      (_programId: never, pollId: number) =>
        [{ toBase58: () => `poll-pda-${pollId}` }, 255] as never,
    );

    // Map candidate names to deterministic fake PDAs
    vi.mocked(deriveCandidatePda).mockImplementation(
      (_config: never, _pollId: number, name: string) =>
        [{ toBase58: () => `cand-pda-${name}` }, 254] as never,
    );
  });

  // ── Empty / no data ─────────────────────────────────────────────────────

  it("returns empty polls when no accounts exist", async () => {
    mockGetAccountInfo.mockResolvedValue(null);

    const { result } = renderHook(() => usePolls());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.polls).toEqual([]);
    expect(result.current.candidates.size).toBe(0);
  });

  it("returns empty polls when getAccountInfo returns undefined", async () => {
    mockGetAccountInfo.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePolls());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.polls).toEqual([]);
  });

  // ── Single poll ─────────────────────────────────────────────────────────

  it("parses a single poll from account data", async () => {
    // Only poll-pda-1 has data; everything else returns null
    mockGetAccountInfo.mockImplementation(async (key: { toBase58: () => string }) => {
      if (key.toBase58() === "poll-pda-1") return { data: new Uint8Array(0) };
      return null;
    });

    mockDecode.mockImplementation((type: string, _data: unknown) => {
      if (type === "PollAccount") return createMockPollDecode();
      return createMockCandidateDecode();
    });

    const { result } = renderHook(() => usePolls());

    await waitFor(() => expect(result.current.polls).toHaveLength(1));
    expect(result.current.loading).toBe(false);

    const poll = result.current.polls[0];
    expect(poll.pollId).toBe(1);
    expect(poll.name).toBe("Test Poll");
    expect(poll.description).toBe("A poll for testing");
    expect(poll.start).toBe(1000);
    expect(poll.end).toBe(2000);
    expect(poll.closed).toBe(false);
    expect(poll.candidateNames).toEqual(["Alice", "Bob"]);
  });

  it("sets closed flag from decoded data", async () => {
    mockGetAccountInfo.mockImplementation(
      async (key: { toBase58: () => string }) =>
        key.toBase58() === "poll-pda-1" ? { data: new Uint8Array(0) } : null,
    );
    mockDecode.mockReturnValue(createMockPollDecode({ closed: true }));

    const { result } = renderHook(() => usePolls());

    await waitFor(() => expect(result.current.polls).toHaveLength(1));
    expect(result.current.polls[0].closed).toBe(true);
  });

  // ── Candidates ──────────────────────────────────────────────────────────

  it("returns candidates for polls that have them", async () => {
    mockGetAccountInfo.mockImplementation(
      async (key: { toBase58: () => string }) => {
        const addr = key.toBase58();
        if (addr === "poll-pda-1") return { data: new Uint8Array(0) };
        if (addr === "cand-pda-Alice") return { data: new Uint8Array(0) };
        if (addr === "cand-pda-Bob") return { data: new Uint8Array(0) };
        return null;
      },
    );

    const decodeCallCount = { calls: 0 };
    mockDecode.mockImplementation((type: string, _data: unknown) => {
      if (type === "PollAccount") return createMockPollDecode();
      if (type === "CandidateAccount" && _data) {
        decodeCallCount.calls++;
        // Return Alice on first candidate call, Bob on second
        const name = decodeCallCount.calls === 1 ? "Alice" : "Bob";
        return createMockCandidateDecode({
          candidateName: name,
          candidateVotes: BigInt(42),
        });
      }
      return createMockCandidateDecode();
    });

    const { result } = renderHook(() => usePolls());

    await waitFor(() => {
      expect(result.current.polls).toHaveLength(1);
      expect(result.current.candidates.size).toBeGreaterThan(0);
    });

    const cands = result.current.candidates.get(1);
    expect(cands).toBeDefined();
    expect(cands!.map((c) => c.name).sort()).toEqual(["Alice", "Bob"]);
  });

  it("skips candidates whose PDA has no account data", async () => {
    mockGetAccountInfo.mockImplementation(
      async (key: { toBase58: () => string }) => {
        const addr = key.toBase58();
        if (addr === "poll-pda-1") return { data: new Uint8Array(0) };
        // Only Alice has data, Bob's PDA returns null
        if (addr === "cand-pda-Alice") return { data: new Uint8Array(0) };
        return null;
      },
    );

    // decode for candidates that exist
    let decodeCall = 0;
    mockDecode.mockImplementation((type: string, _data: unknown) => {
      if (type === "PollAccount")
        return createMockPollDecode({ candidates: "Alice,Bob" });
      if (type === "CandidateAccount") {
        decodeCall++;
        if (decodeCall === 1) return createMockCandidateDecode({ candidateName: "Alice", candidateVotes: BigInt(42) });
        return createMockCandidateDecode(); // shouldn't reach here
      }
      return {};
    });

    const { result } = renderHook(() => usePolls());

    await waitFor(() => {
      expect(result.current.polls).toHaveLength(1);
      expect(result.current.loading).toBe(false);
    });

    // Only Alice should be in candidates
    const cands = result.current.candidates.get(1);
    expect(cands).toBeDefined();
    expect(cands!.length).toBe(1);
    expect(cands![0].name).toBe("Alice");
  });

  // ── Multiple polls ──────────────────────────────────────────────────────

  it("parses multiple polls when multiple accounts exist", async () => {
    mockGetAccountInfo.mockImplementation(
      async (key: { toBase58: () => string }) => {
        const addr = key.toBase58();
        if (addr === "poll-pda-1") return { data: new Uint8Array(0) };
        if (addr === "poll-pda-3") return { data: new Uint8Array(0) };
        return null;
      },
    );

    let decodeCount = 0;
    mockDecode.mockImplementation((type: string, _data: unknown) => {
      decodeCount++;
      if (type === "PollAccount" && decodeCount === 1)
        return createMockPollDecode({ pollName: "First Poll", candidates: "Alice" });
      if (type === "PollAccount" && decodeCount === 2)
        return createMockPollDecode({ pollName: "Third Poll", candidates: "Bob" });
      if (type === "CandidateAccount")
        return createMockCandidateDecode();
      return {};
    });

    const { result } = renderHook(() => usePolls());

    await waitFor(() => expect(result.current.polls).toHaveLength(2));
    expect(result.current.loading).toBe(false);
    expect(result.current.polls[0].pollId).toBe(1);
    expect(result.current.polls[1].pollId).toBe(3);
  });

  // ── Null program guard ──────────────────────────────────────────────────

  it("does not crash nor fetch when program is null", async () => {
    vi.mocked(useApp).mockReturnValue({
      version: "v2",
      programs: { v1: null, v2: null, v3: null },
      connection: { getAccountInfo: mockGetAccountInfo } as never,
      program: null,
    });

    const { result } = renderHook(() => usePolls());

    // The effect runs, fetch is called, but returns early because !program
    // No state changes happen — loading stays false
    await waitFor(() => {
      // fetch never called getAccountInfo or derivePollPda
      expect(mockGetAccountInfo).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
      expect(result.current.polls).toEqual([]);
    });
  });

  // ── Merkle root passthrough ─────────────────────────────────────────────

  it("passes through merkleRoot when present", async () => {
    mockGetAccountInfo.mockImplementation(
      async (key: { toBase58: () => string }) =>
        key.toBase58() === "poll-pda-1" ? { data: new Uint8Array(0) } : null,
    );
    mockDecode.mockReturnValue(
      createMockPollDecode({ merkleRoot: [1, 2, 3] }),
    );

    const { result } = renderHook(() => usePolls());

    await waitFor(() => expect(result.current.polls).toHaveLength(1));
    expect(result.current.polls[0].merkleRoot).toEqual([1, 2, 3]);
  });

  it("does not set merkleRoot when absent (undefined)", async () => {
    mockGetAccountInfo.mockImplementation(
      async (key: { toBase58: () => string }) =>
        key.toBase58() === "poll-pda-1" ? { data: new Uint8Array(0) } : null,
    );
    mockDecode.mockReturnValue(createMockPollDecode({ merkleRoot: undefined }));

    const { result } = renderHook(() => usePolls());

    await waitFor(() => expect(result.current.polls).toHaveLength(1));
    expect(result.current.polls[0].merkleRoot).toBeUndefined();
  });

  // ── refresh ─────────────────────────────────────────────────────────────

  it("refresh re-fetches polls", async () => {
    let phase: "empty" | "data" = "empty";

    mockGetAccountInfo.mockImplementation(
      async (key: { toBase58: () => string }) => {
        if (phase === "empty") return null;
        // During "data" phase, only poll 1 has data
        if (key.toBase58() === "poll-pda-1") return { data: new Uint8Array(0) };
        return null;
      },
    );
    mockDecode.mockReturnValue(createMockPollDecode());

    const { result } = renderHook(() => usePolls());

    // First fetch: all null → 0 polls
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.polls).toHaveLength(0);

    // Switch phase and refresh
    phase = "data";
    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.polls).toHaveLength(1);
    });
    expect(result.current.polls[0].pollId).toBe(1);
  });
});
