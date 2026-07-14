// @vitest-environment node
// PDA derivation is pure computation — no DOM needed. jsdom's Buffer polyfill
// interferes with @solana/web3.js v1's findProgramAddressSync curve checks.
import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import type { VersionConfig } from "../config/versions";
import {
  derivePollPda,
  deriveCandidatePda,
  deriveVoteRecordPda,
  deriveEscrowPda,
} from "./pda";

// Use the deployed v2 program ID — the System Program key (111...11) does not
// produce valid PDAs for any bump value (all derivations lie on the ed25519 curve).
const TEST_PROGRAM_ID = new PublicKey("4jvSdJbH7ReTSRNiNwgKXLDt4UHM6k3KCu8e78Btxpem");

const v1Config: VersionConfig = {
  id: "v1",
  label: "V1 — Account-based",
  programId: TEST_PROGRAM_ID,
  features: { tokenGating: false, merkle: false, escrow: false },
};

const v2Config: VersionConfig = {
  id: "v2",
  label: "V2 — Token-gated",
  programId: TEST_PROGRAM_ID,
  features: { tokenGating: true, merkle: false, escrow: true },
};

const v3Config: VersionConfig = {
  id: "v3",
  label: "V3 — Merkle-tree",
  programId: TEST_PROGRAM_ID,
  features: { tokenGating: false, merkle: true, escrow: false },
};

describe("derivePollPda", () => {
  it("returns deterministic [PublicKey, bump] for same input", () => {
    const [pda1, bump1] = derivePollPda(TEST_PROGRAM_ID, 1);
    const [pda2, bump2] = derivePollPda(TEST_PROGRAM_ID, 1);
    expect(pda1).toBeInstanceOf(PublicKey);
    expect(bump1).toEqual(expect.any(Number));
    expect(pda1.equals(pda2)).toBe(true);
    expect(bump1).toBe(bump2);
  });

  it("returns different PDA for different poll IDs", () => {
    const [pda1] = derivePollPda(TEST_PROGRAM_ID, 1);
    const [pda2] = derivePollPda(TEST_PROGRAM_ID, 2);
    expect(pda1.equals(pda2)).toBe(false);
  });

  it("handles bigint poll IDs", () => {
    const [pda] = derivePollPda(TEST_PROGRAM_ID, BigInt(9007199254740991));
    expect(pda).toBeInstanceOf(PublicKey);
  });

  it("bump is between 0 and 255", () => {
    const [, bump] = derivePollPda(TEST_PROGRAM_ID, 1);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });
});

describe("deriveCandidatePda", () => {
  it("returns deterministic [PublicKey, bump] for same inputs", () => {
    const [pda1, bump1] = deriveCandidatePda(v1Config, 1, "Alice");
    const [pda2, bump2] = deriveCandidatePda(v1Config, 1, "Alice");
    expect(pda1.equals(pda2)).toBe(true);
    expect(bump1).toBe(bump2);
  });

  it("uses different seeds for v1 vs v2/v3 — same poll + name yields different PDAs", () => {
    const [pdaV1] = deriveCandidatePda(v1Config, 1, "Alice");
    const [pdaV2] = deriveCandidatePda(v2Config, 1, "Alice");
    const [pdaV3] = deriveCandidatePda(v3Config, 1, "Alice");
    expect(pdaV1.equals(pdaV2)).toBe(false);
    expect(pdaV2.equals(pdaV3)).toBe(true); // v2 and v3 share the seed layout
  });

  it("returns different PDA for different candidate names", () => {
    const [pda1] = deriveCandidatePda(v2Config, 1, "Alice");
    const [pda2] = deriveCandidatePda(v2Config, 1, "Bob");
    expect(pda1.equals(pda2)).toBe(false);
  });

  it("bump is between 0 and 255", () => {
    const [, bump] = deriveCandidatePda(v1Config, 1, "Alice");
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });
});

describe("deriveVoteRecordPda", () => {
  const user = new PublicKey("22222222222222222222222222222222222222222222");
  const pollAccount = new PublicKey("33333333333333333333333333333333333333333333");

  it("returns null for v3", () => {
    expect(deriveVoteRecordPda(v3Config, 1, user)).toBeNull();
    expect(deriveVoteRecordPda(v3Config, pollAccount, user)).toBeNull();
  });

  it("returns valid PDA for v1", () => {
    const result = deriveVoteRecordPda(v1Config, 1, user);
    expect(result).not.toBeNull();
    const [pda, bump] = result!;
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("returns valid PDA for v2", () => {
    const result = deriveVoteRecordPda(v2Config, pollAccount, user);
    expect(result).not.toBeNull();
    const [pda, bump] = result!;
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("returns different PDA for v1 vs v2 with same user", () => {
    const v1Result = deriveVoteRecordPda(v1Config, 1, user);
    const v2Result = deriveVoteRecordPda(v2Config, pollAccount, user);
    expect(v1Result).not.toBeNull();
    expect(v2Result).not.toBeNull();
    expect(v1Result![0].equals(v2Result![0])).toBe(false);
  });
});

describe("deriveEscrowPda", () => {
  const user = new PublicKey("22222222222222222222222222222222222222222222");
  const pollAccount = new PublicKey("33333333333333333333333333333333333333333333");

  it("returns null for v1", () => {
    expect(deriveEscrowPda(v1Config, pollAccount, user)).toBeNull();
  });

  it("returns null for v3", () => {
    expect(deriveEscrowPda(v3Config, pollAccount, user)).toBeNull();
  });

  it("returns valid PDA for v2", () => {
    const result = deriveEscrowPda(v2Config, pollAccount, user);
    expect(result).not.toBeNull();
    const [pda, bump] = result!;
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("returns different PDA for different users (v2)", () => {
    const otherUser = new PublicKey("44444444444444444444444444444444444444444444");
    const [pda1] = deriveEscrowPda(v2Config, pollAccount, user)!;
    const [pda2] = deriveEscrowPda(v2Config, pollAccount, otherUser)!;
    expect(pda1.equals(pda2)).toBe(false);
  });
});
