import type { Poll } from "../hooks/usePolls";

// ponytail-mode: demo polls per protocol version.
// Used as fallback when on-chain has no data (devnet preview, no-deployed programs).
// Devnet → mainnet = 1-line change in versions.ts (CLUSTER_URL).

export const DEMO_POLLS: Record<string, Poll[]> = {
  v1: [
    {
      pollId: 1,
      name: "Q3 Protocol Roadmap Vote",
      description: "Choose the top priority for the next quarter's development effort.",
      start: Date.now() / 1000 - 86400,
      end: Date.now() / 1000 + 86400 * 6,
      closed: false,
      candidateNames: ["Throughput", "Developer tooling", "Privacy", "Cross-chain"],
    },
    {
      pollId: 2,
      name: "Treasury Allocation 2026",
      description: "Yearly allocation of treasury funds across community initiatives.",
      start: Date.now() / 1000 - 86400 * 2,
      end: Date.now() / 1000 + 86400 * 5,
      closed: false,
      candidateNames: ["Grants", "Liquidity incentives", "Audits", "Reserve"],
    },
  ],
  v2: [
    {
      pollId: 1,
      name: "Token-Gated Feature: Weighted Vote Test",
      description: "Voting power scales with your staked token balance. Showcases V2 escrow-backed weight.",
      start: Date.now() / 1000 - 86400,
      end: Date.now() / 1000 + 86400 * 7,
      closed: false,
      tokenGated: true,
      totalWeight: 1248500,
      candidateNames: ["Accept", "Reject", "Abstain"],
    },
  ],
  v3: [
    {
      pollId: 1,
      name: "Anonymous Delegation Pilot (Merkle)",
      description: "Voters prove inclusion in the allowlist Merkle tree without revealing identity. Nullifier prevents double-vote.",
      start: Date.now() / 1000 - 86400,
      end: Date.now() / 1000 + 86400 * 7,
      closed: false,
      merkleProof: true,
      candidateNames: ["For", "Against", "Recuse"],
    },
  ],
};
