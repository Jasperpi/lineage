import { describe, expect, it } from "vitest";
import { DEFAULT_RELATIONSHIPS, mulberry32, relationshipPosteriors, simulatePair, simulateRelationships, SHARED_CM_V4 } from "../index.js";

// Autosome lengths (cM) of the bundled HapMap II GRCh37 map, rounded; enough for the model's behaviour.
const LENGTHS = [286.3, 268.8, 223.4, 214.7, 204.1, 192.0, 187.2, 168.0, 166.4, 181.1, 158.2, 174.7, 125.7, 120.2, 141.9, 134.0, 128.5, 117.7, 107.7, 108.3, 62.8, 74.1];
const GENOME = LENGTHS.reduce((a, b) => a + b, 0);
const spec = (id: string) => DEFAULT_RELATIONSHIPS.find((r) => r.id === id)!;

describe("pedigree simulation", () => {
  it("a parent and child share every autosome end to end", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 20; i++) {
      const p = simulatePair(spec("parent"), rng, LENGTHS);
      expect(p.segments).toBe(22);
      expect(p.totalCm).toBeCloseTo(GENOME, 6);
      expect(p.fullCm).toBe(0);
    }
  });

  it("full siblings share about three quarters of the genome, a quarter of it on both copies", () => {
    const [d] = simulateRelationships([spec("sibling")], { chromosomeCm: LENGTHS, pairs: 300, seed: 3 });
    expect(d!.summary.meanCm / GENOME).toBeGreaterThan(0.71);
    expect(d!.summary.meanCm / GENOME).toBeLessThan(0.77);
    const full = d!.pairs.reduce((a, p) => a + p.fullCm, 0) / d!.pairs.length;
    expect(full / GENOME).toBeGreaterThan(0.22);
    expect(full / GENOME).toBeLessThan(0.28);
  });

  it("half siblings never share a region on both copies", () => {
    const [d] = simulateRelationships([spec("half-sibling")], { chromosomeCm: LENGTHS, pairs: 100, seed: 4 });
    expect(d!.pairs.every((p) => p.fullCm === 0)).toBe(true);
  });

  it("means agree with the crowd-sourced Shared cM Project averages for close relationships", () => {
    const ids = ["sibling", "half-sibling", "grandparent", "aunt-uncle", "1C"];
    const dists = simulateRelationships(ids.map(spec), { chromosomeCm: LENGTHS, pairs: 400, seed: 5 });
    for (const d of dists) {
      const v4 = SHARED_CM_V4.find((e) => e.id === d.spec.sharedCmId)!;
      // The two differ in genome length (3,546 vs ~3,485 cM) and ascertainment; 5% is generous for close kin.
      expect(Math.abs(d.summary.meanCm - v4.average) / v4.average).toBeLessThan(0.05);
    }
  });

  it("distant cousins often share nothing detectable", () => {
    const [d] = simulateRelationships([spec("5C")], { chromosomeCm: LENGTHS, pairs: 300, seed: 6 });
    expect(d!.summary.noSharing).toBeGreaterThan(0.6);
  });

  it("is reproducible from its seed", () => {
    const a = simulateRelationships([spec("2C")], { chromosomeCm: LENGTHS, pairs: 50, seed: 9 })[0]!.pairs;
    const b = simulateRelationships([spec("2C")], { chromosomeCm: LENGTHS, pairs: 50, seed: 9 })[0]!.pairs;
    expect(a).toEqual(b);
  });
});

describe("relationship likelihoods", () => {
  const dists = simulateRelationships(["half-sibling", "grandparent", "aunt-uncle", "1C", "2C", "3C"].map(spec), { chromosomeCm: LENGTHS, pairs: 800, seed: 11 });

  it("probabilities sum to one", () => {
    const post = relationshipPosteriors(dists, { totalCm: 1750, segments: 30 });
    expect(post.reduce((a, p) => a + p.probability, 0)).toBeCloseTo(1, 9);
  });

  it("segment counts separate a grandparent from a half sibling at the same total", () => {
    const few = relationshipPosteriors(dists, { totalCm: 1750, segments: 24 });
    const many = relationshipPosteriors(dists, { totalCm: 1750, segments: 44 });
    expect(few[0]!.spec.id).toBe("grandparent");
    expect(many[0]!.spec.id).not.toBe("grandparent");
    const gpFew = few.find((p) => p.spec.id === "grandparent")!.probability;
    const gpMany = many.find((p) => p.spec.id === "grandparent")!.probability;
    expect(gpFew).toBeGreaterThan(0.9);
    expect(gpMany).toBeLessThan(0.05);
  });

  it("a total alone leaves the 1,750 cM trio undecided", () => {
    const post = relationshipPosteriors(dists, { totalCm: 1750 });
    const top3 = post.slice(0, 3).map((p) => p.probability);
    expect(top3.every((p) => p > 0.15 && p < 0.6)).toBe(true);
  });

  it("no detectable sharing favours the most distant relationship", () => {
    const post = relationshipPosteriors(dists, { totalCm: 0 });
    expect(post[0]!.spec.id).toBe("3C");
  });
});
