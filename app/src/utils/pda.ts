import { PublicKey } from "@solana/web3.js";
import type { VersionConfig } from "../config/versions";

function u64ToBytes(value: number | bigint): Uint8Array {
  const buf = new Uint8Array(8);
  const big = BigInt(value);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((big >> BigInt(i * 8)) & BigInt(0xff));
  }
  return buf;
}

const textEncoder = new TextEncoder();

// ── Poll PDA ────────────────────────────────────────────────────────────────
// All versions: ["poll", poll_id_le]
export function derivePollPda(
  programId: PublicKey,
  pollId: number | bigint
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("poll"), Buffer.from(u64ToBytes(pollId))],
    programId
  );
}

// ── Candidate PDA ───────────────────────────────────────────────────────────
// V1: [poll_id_le, candidate_name_utf8]
// V2/V3: ["poll", poll_id_le, candidate_name_utf8]
export function deriveCandidatePda(
  version: VersionConfig,
  pollId: number | bigint,
  name: string
): [PublicKey, number] {
  const pollIdBytes = Buffer.from(u64ToBytes(pollId));
  const nameBytes = Buffer.from(textEncoder.encode(name));

  const seeds: Buffer[] =
    version.id === "v1"
      ? [pollIdBytes, nameBytes]
      : [Buffer.from("poll"), pollIdBytes, nameBytes];

  return PublicKey.findProgramAddressSync(seeds, version.programId);
}

// ── Vote Record PDA ─────────────────────────────────────────────────────────
// V1: ["voter", poll_id_le, user_pubkey]
// V2: ["voted", poll_account_pubkey, user_pubkey]
// V3: null (no VoteRecord account)
export function deriveVoteRecordPda(
  version: VersionConfig,
  pollIdOrAccount: number | bigint | PublicKey,
  user: PublicKey
): [PublicKey, number] | null {
  if (version.id === "v3") return null;

  if (version.id === "v1") {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("voter"),
        Buffer.from(u64ToBytes(pollIdOrAccount as number | bigint)),
        user.toBuffer(),
      ],
      version.programId
    );
  }

  // v2
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("voted"),
      (pollIdOrAccount as PublicKey).toBuffer(),
      user.toBuffer(),
    ],
    version.programId
  );
}

// ── Escrow Vault PDA ────────────────────────────────────────────────────────
// V2 only: ["escrow", poll_account_pubkey, user_pubkey]
// V1/V3: null
export function deriveEscrowPda(
  version: VersionConfig,
  pollAccount: PublicKey,
  user: PublicKey
): [PublicKey, number] | null {
  if (version.id !== "v2") return null;

  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("escrow"),
      pollAccount.toBuffer(),
      user.toBuffer(),
    ],
    version.programId
  );
}
