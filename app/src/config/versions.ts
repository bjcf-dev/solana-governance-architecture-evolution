import { PublicKey } from "@solana/web3.js";

export type VersionId = "v1" | "v2" | "v3";

export interface VersionConfig {
  id: VersionId;
  label: string;
  programId: PublicKey;
  features: {
    tokenGating: boolean;
    merkle: boolean;
    escrow: boolean;
  };
}

// ponytail: hardcoded devnet endpoint; mainnet = 1-line change in clusterUrl
export const CLUSTER_URL = "https://api.devnet.solana.com";

export const PROGRAM_IDS: Record<VersionId, string> = {
  v1: "3ZymoFt5iejQYVLnxvpU4pd3ekexHXkcrBiypRvqarU3",
  v2: "4jvSdJbH7ReTSRNiNwgKXLDt4UHM6k3KCu8e78Btxpem",
  v3: "e956D3re1SUEx68mDUdzxujGBhfoXZBEBC75HKigEod",
};

export const VERSIONS: VersionConfig[] = [
  {
    id: "v1",
    label: "V1 — Account-based",
    programId: new PublicKey(PROGRAM_IDS.v1),
    features: { tokenGating: false, merkle: false, escrow: false },
  },
  {
    id: "v2",
    label: "V2 — Token-gated",
    programId: new PublicKey(PROGRAM_IDS.v2),
    features: { tokenGating: true, merkle: false, escrow: true },
  },
  {
    id: "v3",
    label: "V3 — Merkle-tree",
    programId: new PublicKey(PROGRAM_IDS.v3),
    features: { tokenGating: false, merkle: true, escrow: false },
  },
];

export function getVersion(id: VersionId): VersionConfig {
  const v = VERSIONS.find((v) => v.id === id);
  if (!v) throw new Error(`Unknown version: ${id}`);
  return v;
}
