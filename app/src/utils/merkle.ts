import { sha256 } from "@noble/hashes/sha256";

// If larger trees are needed, move computation to a Web Worker.

export interface MerkleTree {
  root: Uint8Array;
  leaves: Uint8Array[];
  layers: Uint8Array[][];
}

export interface ProofPath {
  /** Sibling hashes ordered from leaf to root. */
  proof: Uint8Array[];
  /** Leaf index needed by the V3 program for left/right ordering. */
  leafIndex: number;
}

// ── Build tree ──────────────────────────────────────────────────────────────

/** Pads leaves to the next power of 2 with zero hashes (32 null bytes). */
function padLeaves(leaves: Uint8Array[]): Uint8Array[] {
  const size = 1 << Math.ceil(Math.log2(leaves.length));
  const padded = leaves.slice();
  const zero = new Uint8Array(32);
  while (padded.length < size) padded.push(zero);
  return padded;
}

/**
 * Builds a full Merkle tree from leaf hashes.
 * Leaves are padded to the next power of 2 automatically.
 */
export function buildTree(leaves: Uint8Array[]): MerkleTree {
  const layers: Uint8Array[][] = [];
  let current = padLeaves(leaves);
  layers.push(current);

  while (current.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];

      const combined = new Uint8Array(64);
      combined.set(left);
      combined.set(right, 32);
      next.push(sha256(combined));
    }
    current = next;
    layers.push(current);
  }

  return {
    root: current[0],
    leaves, // original (unpadded) leaves
    layers,
  };
}

// ── Generate proof ──────────────────────────────────────────────────────────

/**
 * Generates a Merkle proof for a given leaf.
 * Returns sibling hashes + the leaf's index for left/right ordering.
 */
export function getProof(tree: MerkleTree, leaf: Uint8Array): ProofPath {
  const leafIndex = tree.leaves.findIndex(
    (l) => l.length === leaf.length && l.every((v, i) => v === leaf[i])
  );
  if (leafIndex === -1) throw new Error("Leaf not found in tree");

  const proof: Uint8Array[] = [];
  let idx = leafIndex;

  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const siblings = tree.layers[layer];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;

    if (siblingIdx < siblings.length) {
      proof.push(siblings[siblingIdx]);
    }
    idx = Math.floor(idx / 2);
  }

  return { proof, leafIndex };
}

// ── Verify proof ────────────────────────────────────────────────────────────

/**
 * Verifies a Merkle proof against a known root.
 * Requires the leaf index for correct left/right ordering.
 */
export function verifyProof(
  proof: Uint8Array[],
  root: Uint8Array,
  leaf: Uint8Array,
  leafIndex: number
): boolean {
  let current = leaf;
  let idx = leafIndex;

  for (const sibling of proof) {
    const combined = new Uint8Array(64);

    if (idx % 2 === 0) {
      combined.set(current);
      combined.set(sibling, 32);
    } else {
      combined.set(sibling);
      combined.set(current, 32);
    }

    current = sha256(combined);
    idx = Math.floor(idx / 2);
  }

  return current.length === root.length &&
    current.every((v, i) => v === root[i]);
}
