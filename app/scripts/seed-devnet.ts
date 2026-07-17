import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import fs from "fs";

const PROGRAM_ID = new PublicKey("3ZymoFt5iejQYVLnxvpU4pd3ekexHXkcrBiypRvqarU3");
const CLUSTER_URL = "https://api.devnet.solana.com";
const WALLET_PATH = process.env.HOME + "/.config/solana/id.json";

function loadKeypair(): Keypair {
  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function findPollPda(pollId: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("poll"), new BN(pollId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  );
}

function findCandidatePda(pollId: number, candidateName: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      new BN(pollId).toArrayLike(Buffer, "le", 8),
      Buffer.from(candidateName),
    ],
    PROGRAM_ID
  );
}

const IDL = JSON.parse(
  fs.readFileSync(new URL("./../src/config/idl/v1.json", import.meta.url), "utf-8")
);

async function main() {
  const connection = new Connection(CLUSTER_URL, "confirmed");
  const wallet = loadKeypair();
  const provider = new AnchorProvider(connection, new Wallet(wallet), {});
  const program = new Program(IDL, provider);

  const pollId = 2;

  // 1. init_poll
  const [pollPda] = findPollPda(pollId);
  const now = Math.floor(Date.now() / 1000);
  const end = now + 7 * 24 * 3600;

  console.log(`Creating poll (id=${pollId}) at ${pollPda.toBase58()}...`);
  await program.methods
    .initPoll(new BN(pollId), new BN(now), new BN(end), "Solana 2026 Upgrade", "Vote for the next protocol upgrade direction.")
    .accounts({ user: wallet.publicKey, pollAccount: pollPda })
    .rpc();

  // 2. add candidates
  const candidates = ["Yes — ship it", "No — hold", "Abstain"];
  for (const name of candidates) {
    const [candPda] = findCandidatePda(pollId, name);
    console.log(`Adding candidate: ${name} (${candPda.toBase58()})`);
    await program.methods
      .initializeCandidate(name, new BN(pollId))
      .accounts({
        user: wallet.publicKey,
        pollAccount: pollPda,
        candidateAccount: candPda,
      })
      .rpc();
  }

  console.log("✅ Seed complete. Poll + 3 candidates on devnet.");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
