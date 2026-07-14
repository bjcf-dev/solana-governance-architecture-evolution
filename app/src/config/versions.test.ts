import { describe, it, expect } from "vitest";
import { VERSIONS, PROGRAM_IDS, CLUSTER_URL, getVersion } from "./versions";

describe("getVersion", () => {
  it("returns correct config for v1", () => {
    const v = getVersion("v1");
    expect(v.id).toBe("v1");
    expect(v.label).toContain("Account");
    expect(v.features.tokenGating).toBe(false);
    expect(v.features.merkle).toBe(false);
    expect(v.features.escrow).toBe(false);
    expect(v.programId.toBase58()).toBe(PROGRAM_IDS.v1);
  });

  it("returns correct config for v2", () => {
    const v = getVersion("v2");
    expect(v.id).toBe("v2");
    expect(v.label).toContain("Token");
    expect(v.features.tokenGating).toBe(true);
    expect(v.features.merkle).toBe(false);
    expect(v.features.escrow).toBe(true);
    expect(v.programId.toBase58()).toBe(PROGRAM_IDS.v2);
  });

  it("returns correct config for v3", () => {
    const v = getVersion("v3");
    expect(v.id).toBe("v3");
    expect(v.label).toContain("Merkle");
    expect(v.features.tokenGating).toBe(false);
    expect(v.features.merkle).toBe(true);
    expect(v.features.escrow).toBe(false);
    expect(v.programId.toBase58()).toBe(PROGRAM_IDS.v3);
  });

  it("throws for unknown version", () => {
    expect(() => getVersion("v4" as never)).toThrow("Unknown version");
  });

  it("throws for empty string", () => {
    expect(() => getVersion("" as never)).toThrow("Unknown version");
  });
});

describe("VERSIONS", () => {
  it("has exactly 3 entries", () => {
    expect(VERSIONS).toHaveLength(3);
  });

  it("each entry has correct shape", () => {
    for (const v of VERSIONS) {
      expect(v).toHaveProperty("id");
      expect(v).toHaveProperty("label");
      expect(v).toHaveProperty("programId");
      expect(v).toHaveProperty("features");
      expect(v.features).toHaveProperty("tokenGating");
      expect(v.features).toHaveProperty("merkle");
      expect(v.features).toHaveProperty("escrow");
      expect(typeof v.label).toBe("string");
    }
  });
});

describe("PROGRAM_IDS", () => {
  it("has keys matching VERSIONS ids", () => {
    const ids = Object.keys(PROGRAM_IDS).sort();
    const versionIds = VERSIONS.map((v) => v.id).sort();
    expect(ids).toEqual(versionIds);
  });

  it("each PROGRAM_ID matches its corresponding VERSIONS programId base58", () => {
    for (const v of VERSIONS) {
      expect(v.programId.toBase58()).toBe(PROGRAM_IDS[v.id]);
    }
  });
});

describe("CLUSTER_URL", () => {
  it("is a non-empty string", () => {
    expect(typeof CLUSTER_URL).toBe("string");
    expect(CLUSTER_URL.length).toBeGreaterThan(0);
  });

  it("starts with https://", () => {
    expect(CLUSTER_URL.startsWith("https://")).toBe(true);
  });

  it("can be parsed as a URL", () => {
    expect(() => new URL(CLUSTER_URL)).not.toThrow();
  });
});
