// @vitest-environment node
// Merkle tree functions use @noble/hashes/sha256 with Uint8Array — no DOM needed.
// Node environment ensures Buffer compatibility for byte-level comparisons.
import { describe, it, expect } from "vitest";
import { sha256 } from "@noble/hashes/sha256";
import { buildTree, getProof, verifyProof } from "./merkle";

function hex(h: Uint8Array): string {
  return Array.from(h)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("buildTree", () => {
  it("returns root and leaves for a single leaf", () => {
    const leaf = sha256(new Uint8Array([1]));
    const tree = buildTree([leaf]);

    expect(tree.leaves).toHaveLength(1);
    expect(tree.root).toBeInstanceOf(Uint8Array);
    expect(tree.root.length).toBe(32);
    // Single unpadded leaf: the root IS the leaf itself
    expect(tree.root).toEqual(leaf);
  });

  it("builds tree with 3 leaves (pads to 4)", () => {
    const leaves = [1, 2, 3].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);

    // buildTree stores original unpadded leaves
    expect(tree.leaves).toHaveLength(3);
    expect(tree.layers[0]).toHaveLength(4); // padded to next power of 2
  });

  it("builds tree with 4 leaves (exact power of 2 — no padding)", () => {
    const leaves = [1, 2, 3, 4].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);

    expect(tree.leaves).toHaveLength(4);
    // First layer is padded version — 4 stays 4
    expect(tree.layers[0]).toHaveLength(4);
    // Second layer has 2 nodes
    expect(tree.layers[1]).toHaveLength(2);
    // Root layer has 1 node
    expect(tree.root).toBeDefined();
  });

  it("is deterministic — same input yields same tree", () => {
    const leaves = [1, 2, 3].map((n) => sha256(new Uint8Array([n])));
    const tree1 = buildTree(leaves);
    const tree2 = buildTree(leaves);

    expect(tree1.root).toEqual(tree2.root);
    expect(tree1.leaves).toEqual(tree2.leaves);
    expect(tree1.layers).toEqual(tree2.layers);

    // Same hex
    expect(hex(tree1.root)).toBe(hex(tree2.root));
  });

  it("pads to next power of 2 — 5 leaves pads to 8", () => {
    const leaves = [1, 2, 3, 4, 5].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);

    expect(tree.leaves).toHaveLength(5);
    expect(tree.layers[0]).toHaveLength(8); // next power of 2
    // Layers for 8 leaves: 8 → 4 → 2 → 1
    expect(tree.layers).toHaveLength(4);
    expect(tree.root).toBeDefined();
  });

  it("returns same root for identical leaves across multiple calls", () => {
    const a = buildTree([1, 2, 3].map((n) => sha256(new Uint8Array([n]))));
    const b = buildTree([1, 2, 3].map((n) => sha256(new Uint8Array([n]))));
    expect(a.root).toEqual(b.root);
  });
});

describe("getProof", () => {
  it("returns valid proof for a known leaf", () => {
    const leaves = [1, 2, 3, 4].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);
    const leaf = leaves[1];

    const result = getProof(tree, leaf);

    expect(result.leafIndex).toBe(1);
    expect(result.proof.length).toBeGreaterThan(0);
    // 4 leaves → 2 layers → proof has 2 siblings: one at leaf level, one at parent level
    expect(result.proof).toHaveLength(2);
  });

  it("each proof sibling is 32 bytes", () => {
    const leaves = [1, 2, 3, 4].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);
    const leaf = leaves[0];

    const { proof } = getProof(tree, leaf);
    for (const sibling of proof) {
      expect(sibling).toBeInstanceOf(Uint8Array);
      expect(sibling.length).toBe(32);
    }
  });

  it("throws for unknown leaf", () => {
    const leaves = [1, 2].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);
    const unknownLeaf = sha256(new Uint8Array([99]));

    expect(() => getProof(tree, unknownLeaf)).toThrow("Leaf not found");
  });

  it("throws for empty Uint8Array that is not a leaf", () => {
    const leaves = [1, 2].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);

    expect(() => getProof(tree, new Uint8Array(0))).toThrow("Leaf not found");
  });
});

describe("verifyProof", () => {
  it("returns true for valid proof", () => {
    const leaves = [1, 2, 3, 4].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);
    const leaf = leaves[2];

    const { proof, leafIndex } = getProof(tree, leaf);
    expect(verifyProof(proof, tree.root, leaf, leafIndex)).toBe(true);
  });

  it("returns false for tampered leaf", () => {
    const leaves = [1, 2, 3, 4].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);
    const originalLeaf = leaves[2];
    const tamperedLeaf = sha256(new Uint8Array([99]));

    const { proof, leafIndex } = getProof(tree, originalLeaf);
    expect(verifyProof(proof, tree.root, tamperedLeaf, leafIndex)).toBe(false);
  });

  it("returns false for tampered root", () => {
    const leaves = [1, 2, 3, 4].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);
    const leaf = leaves[2];
    const fakeRoot = sha256(new Uint8Array([42]));

    const { proof, leafIndex } = getProof(tree, leaf);
    expect(verifyProof(proof, fakeRoot, leaf, leafIndex)).toBe(false);
  });

  it("returns false for wrong leaf index", () => {
    const leaves = [1, 2, 3, 4].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);
    const leaf = leaves[2]; // index 2

    const { proof } = getProof(tree, leaf);
    // Use proof from leaf 2 but claim it's leaf 0 — wrong ordering
    expect(verifyProof(proof, tree.root, leaf, 0)).toBe(false);
  });

  it("verifies proof for every leaf in a 3-leaf tree", () => {
    const leaves = [1, 2, 3].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);

    for (let i = 0; i < leaves.length; i++) {
      const { proof, leafIndex } = getProof(tree, leaves[i]);
      expect(verifyProof(proof, tree.root, leaves[i], leafIndex)).toBe(true);
    }
  });

  it("verifies proof for 5-leaf tree", () => {
    const leaves = [10, 20, 30, 40, 50].map((n) => sha256(new Uint8Array([n])));
    const tree = buildTree(leaves);

    for (let i = 0; i < leaves.length; i++) {
      const { proof, leafIndex } = getProof(tree, leaves[i]);
      expect(verifyProof(proof, tree.root, leaves[i], leafIndex)).toBe(true);
    }
  });
});
