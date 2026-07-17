import type { VersionId } from "../config/versions";

// ── Types ───────────────────────────────────────────────────────────────────

export interface VoteRecord {
  pollId: number;
  version: VersionId;
  candidate: string;
  /** Token amount locked (V2 only). */
  amount?: number;
  timestamp: number;
  txSignature: string;
  status: "voted" | "withdrawn";
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "solana-vote-history";

// ── Persistence ─────────────────────────────────────────────────────────────

function readAll(): VoteRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VoteRecord[];
  } catch {
    return [];
  }
}

function writeAll(records: VoteRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Append a vote record to the history. */
export function saveVote(record: VoteRecord): void {
  const records = readAll();
  records.push(record);
  writeAll(records);
}

/** Read all stored vote records (newest first). */
export function getHistory(): VoteRecord[] {
  return readAll().reverse();
}

/**
 * Update the status of a specific vote.
 * Matches by (pollId, txSignature) since a user may vote multiple times.
 */
export function updateStatus(
  pollId: number,
  txSignature: string,
  newStatus: "voted" | "withdrawn"
): void {
  const records = readAll();
  const match = records.find(
    (r) => r.pollId === pollId && r.txSignature === txSignature
  );
  if (match) {
    match.status = newStatus;
    writeAll(records);
  }
}

/** Clear all vote history. */
export function clearHistory(): void {
  writeAll([]);
}
