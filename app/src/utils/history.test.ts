import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveVote, getHistory, updateStatus, clearHistory } from "./history";
import type { VoteRecord } from "./history";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(overrides?: Partial<VoteRecord>): VoteRecord {
  return {
    pollId: 1,
    version: "v2",
    candidate: "Alice",
    timestamp: 1000,
    txSignature: "sig-1",
    status: "voted",
    ...overrides,
  };
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  const store = new Map<string, string>();

  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => [...store.keys()][index] ?? null),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("saveVote", () => {
  it("appends a record to localStorage", () => {
    saveVote(makeRecord());
    const raw = localStorage.getItem("solana-vote-history");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].txSignature).toBe("sig-1");
  });

  it("appends multiple records", () => {
    saveVote(makeRecord({ pollId: 1, txSignature: "sig-1" }));
    saveVote(makeRecord({ pollId: 2, txSignature: "sig-2" }));

    const raw = localStorage.getItem("solana-vote-history");
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(2);
  });
});

describe("getHistory", () => {
  it("returns records newest-first", () => {
    saveVote(makeRecord({ pollId: 1, timestamp: 100 }));
    saveVote(makeRecord({ pollId: 2, timestamp: 200 }));

    const history = getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].pollId).toBe(2); // newest first
    expect(history[1].pollId).toBe(1);
  });

  it("returns empty array when no records exist", () => {
    expect(getHistory()).toEqual([]);
  });

  it("returns empty array when localStorage key is missing", () => {
    localStorage.removeItem("solana-vote-history");
    expect(getHistory()).toEqual([]);
  });
});

describe("updateStatus", () => {
  it("changes status by matching pollId + txSignature", () => {
    saveVote(makeRecord({ pollId: 1, txSignature: "sig-a", status: "voted" }));
    saveVote(makeRecord({ pollId: 1, txSignature: "sig-b", status: "voted" }));

    updateStatus(1, "sig-a", "withdrawn");

    const history = getHistory();
    const updated = history.find((r) => r.txSignature === "sig-a");
    const unchanged = history.find((r) => r.txSignature === "sig-b");
    expect(updated?.status).toBe("withdrawn");
    expect(unchanged?.status).toBe("voted");
  });

  it("does nothing when no match found", () => {
    saveVote(makeRecord({ pollId: 1, txSignature: "sig-1" }));
    updateStatus(2, "sig-1", "withdrawn");

    const history = getHistory();
    expect(history[0].status).toBe("voted");
  });
});

describe("clearHistory", () => {
  it("removes all records", () => {
    saveVote(makeRecord());
    saveVote(makeRecord({ txSignature: "sig-2" }));

    clearHistory();

    expect(getHistory()).toEqual([]);
  });

  it("is idempotent — calling twice does not error", () => {
    clearHistory();
    clearHistory();
    expect(getHistory()).toEqual([]);
  });
});

describe("edge cases", () => {
  it("handles corrupt localStorage data — returns empty array", () => {
    localStorage.setItem("solana-vote-history", "{broken json!!");
    // Should not crash
    expect(getHistory()).toEqual([]);
  });

  it("handles corrupt data in saveVote — overwrites with fresh array", () => {
    localStorage.setItem("solana-vote-history", "{broken json!!");
    // Should not crash
    saveVote(makeRecord());

    const history = getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].txSignature).toBe("sig-1");
  });

  it("handles localStorage setItem throwing (quota exceeded)", () => {
    // Make setItem throw for any write
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    // Should not crash
    expect(() => saveVote(makeRecord())).not.toThrow();
    // readAll returns empty (failed write = nothing persisted)
    expect(getHistory()).toEqual([]);
  });

  it("handles localStorage getItem returning null for missing key", () => {
    localStorage.removeItem("solana-vote-history");
    expect(getHistory()).toEqual([]);
    // Should not error after clearing
    saveVote(makeRecord());
    expect(getHistory()).toHaveLength(1);
  });
});
