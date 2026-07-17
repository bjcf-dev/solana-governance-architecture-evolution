import { useCallback } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useApp } from "../context/AppContext";
import { getVersion } from "../config/versions";
import {
  deriveCandidatePda,
  deriveEscrowPda,
  derivePollPda,
  deriveVoteRecordPda,
} from "../utils/pda";
import { buildTree, getProof } from "../utils/merkle";
import { sha256 } from "@noble/hashes/sha256";
import type { VersionId } from "../config/versions";

const GOVERNANCE_MINT = new PublicKey("F9G7jZqJiLkqNojyo1gFjz6Kxg9GzKEGjFyQp7LxPump");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

interface VoteArgs {
  pollId: number;
  candidate: string;
  amount?: number;
  proof?: Uint8Array[];
  leafIndex?: number;
}

export function useVote(versionId?: VersionId) {
  const { version: ctxVersion, programs, connection } = useApp();
  const version = versionId ?? ctxVersion;
  const program = programs[version];
  const wallet = useWallet();
  const config = getVersion(version);

  const vote = useCallback(
    async ({ pollId, candidate, amount, proof, leafIndex }: VoteArgs): Promise<string> => {
      if (!program || !wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
      const [pollPda] = derivePollPda(config.programId, pollId);
      const [candidatePda] = deriveCandidatePda(config, pollId, candidate);

      if (version === "v1") {
        const [voteRecord] = deriveVoteRecordPda(config, pollId, wallet.publicKey)!;
        const ix = await program.methods.vote(pollId, candidate).accounts({
          user: wallet.publicKey,
          pollAccount: pollPda,
          candidateAccount: candidatePda,
          voteRecord,
          systemProgram: SYSTEM_PROGRAM_ID,
        }).instruction();
        const sig = await wallet.sendTransaction(new Transaction().add(ix), connection);
        await connection.confirmTransaction(sig, "confirmed");
        return sig;
      }

      if (version === "v2") {
        const tokenAccounts = await connection.getTokenAccountsByOwner(wallet.publicKey, { mint: GOVERNANCE_MINT });
        if (tokenAccounts.value.length === 0) throw new Error("No governance token found");
        const [voteRecord] = deriveVoteRecordPda(config, pollPda, wallet.publicKey)!;
        const [escrowVault] = deriveEscrowPda(config, pollPda, wallet.publicKey)!;

        const ix = await program.methods.vote(pollId, candidate, amount ?? 0).accounts({
          user: wallet.publicKey,
          pollAccount: pollPda,
          candidateAccount: candidatePda,
          voteRecord,
          userTokenAccount: tokenAccounts.value[0].pubkey,
          governanceTokenMint: GOVERNANCE_MINT,
          escrowVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SYSTEM_PROGRAM_ID,
        }).instruction();
        const sig = await wallet.sendTransaction(new Transaction().add(ix), connection);
        await connection.confirmTransaction(sig, "confirmed");
        return sig;
      }

      // V3 — merkle proof vote
      let usedProof = proof;
      let usedLeafIndex = leafIndex;
      if (!usedProof || usedLeafIndex == null) {
        const amountBuf = new Uint8Array(8);
        const amt = BigInt(amount ?? 1);
        for (let i = 0; i < 8; i++) amountBuf[i] = Number((amt >> BigInt(i * 8)) & BigInt(0xff));
        const leaf = sha256(Buffer.concat([wallet.publicKey.toBytes(), Buffer.from(candidate), amountBuf]));
        const tree = buildTree([leaf]);
        const p = getProof(tree, leaf);
        usedProof = p.proof;
        usedLeafIndex = p.leafIndex;
      }

      const ix = await program.methods.vote(pollId, candidate, amount ?? 1, usedProof, usedLeafIndex).accounts({
        user: wallet.publicKey,
        pollAccount: pollPda,
        candidateAccount: candidatePda,
        systemProgram: SYSTEM_PROGRAM_ID,
      }).instruction();

      const sig = await wallet.sendTransaction(new Transaction().add(ix), connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    },
    [program, wallet, connection, version, config],
  );

  const withdraw = useCallback(
    async (pollId: number): Promise<string> => {
      if (!program || !wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
      if (version !== "v2") throw new Error("Withdraw only available for V2");
      const [pollPda] = derivePollPda(config.programId, pollId);
      const [voteRecord] = deriveVoteRecordPda(config, pollPda, wallet.publicKey)!;
      const [escrowVault] = deriveEscrowPda(config, pollPda, wallet.publicKey)!;

      const tokenAccounts = await connection.getTokenAccountsByOwner(wallet.publicKey, { mint: GOVERNANCE_MINT });
      if (tokenAccounts.value.length === 0) throw new Error("No token account");

      const ix = await program.methods.withdrawTokens(pollId).accounts({
        user: wallet.publicKey,
        pollAccount: pollPda,
        voteRecord,
        escrowVault,
        userTokenAccount: tokenAccounts.value[0].pubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).instruction();

      const sig = await wallet.sendTransaction(new Transaction().add(ix), connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    },
    [program, wallet, connection, version, config],
  );

  const closePoll = useCallback(
    async (pollId: number): Promise<string> => {
      if (!program || !wallet.publicKey || !wallet.signTransaction) throw new Error("Wallet not connected");
      const [pollPda] = derivePollPda(config.programId, pollId);
      const ix = await program.methods.closePoll(pollId).accounts({
        user: wallet.publicKey,
        pollAccount: pollPda,
      }).instruction();

      const sig = await wallet.sendTransaction(new Transaction().add(ix), connection);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    },
    [program, wallet, connection, config],
  );

  return { vote, withdraw, closePoll };
}
