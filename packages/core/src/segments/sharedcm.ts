/**
 * Shared cM Project v4 (Blaine T. Bettinger, March 2020), as published in the
 * DNA Painter Shared cM Tool (https://dnapainter.com/tools/sharedcmv4).
 * Crowd-sourced averages and observed ranges of total shared autosomal cM per
 * relationship, licensed CC BY 4.0. The values below were extracted verbatim
 * from that page on 2026-09-24; see data/sharedcm/sharedcm_v4.json.
 *
 * These are OBSERVED ranges from submitted matches, not theoretical bounds.
 * Ranges overlap heavily, so a single cM total never proves a relationship;
 * the tables tell you what is consistent with the data, not what is true.
 */

export interface SharedCmEntry {
  id: string;
  label: string;
  average: number;
  min: number;
  max: number;
  /** Generations up from self to the common ancestor(s), and down to the match. */
  up: number;
  down: number;
  half: boolean;
}

const R = (id: string, label: string, average: number, min: number, max: number, up: number, down: number, half = false): SharedCmEntry =>
  ({ id, label, average, min, max, up, down, half });

export const SHARED_CM_V4: readonly SharedCmEntry[] = [
  R("Parent", "Parent", 3485, 2376, 3720, 1, 0),
  R("Child", "Child", 3487, 3330, 3720, 0, 1),
  R("Sibling", "Full sibling", 2613, 1613, 3488, 1, 1),
  R("Half_Sibling", "Half sibling", 1759, 1160, 2436, 1, 1, true),
  R("Grandparent", "Grandparent", 1754, 984, 2462, 2, 0),
  R("Grandchild", "Grandchild", 1754, 984, 2462, 0, 2),
  R("Aunt_/_Uncle", "Aunt / uncle", 1741, 1201, 2282, 2, 1),
  R("Niece_/_Nephew", "Niece / nephew", 1740, 1201, 2282, 1, 2),
  R("Half_Aunt_/_Uncle", "Half aunt / uncle", 871, 492, 1315, 2, 1, true),
  R("Half_Niece_/_Nephew", "Half niece / nephew", 871, 492, 1315, 1, 2, true),
  R("Great-Grandparent", "Great-grandparent", 887, 485, 1486, 3, 0),
  R("Great-Grandchild", "Great-grandchild", 887, 485, 1486, 0, 3),
  R("Great-Aunt_/_Uncle", "Great-aunt / uncle", 850, 330, 1467, 3, 1),
  R("Great-Niece_/_Nephew", "Great-niece / nephew", 850, 330, 1467, 1, 3),
  R("Half_Great-Aunt_/_Uncle", "Half great-aunt / uncle", 431, 184, 668, 3, 1, true),
  R("Half_Great-Niece_/_Nephew", "Half great-niece / nephew", 431, 184, 668, 1, 3, true),
  R("Great-Great-Aunt_/_Uncle", "Great-great-aunt / uncle", 420, 186, 713, 4, 1),
  R("Great-Great-Niece_/_Nephew", "Great-great-niece / nephew", 420, 186, 713, 1, 4),
  R("Half_GG-Aunt_/_Uncle", "Half great-great-aunt / uncle", 208, 103, 284, 4, 1, true),
  R("Half_GG-Niece_/_Nephew", "Half great-great-niece / nephew", 208, 103, 284, 1, 4, true),
  R("1C", "First cousin", 866, 396, 1397, 2, 2),
  R("Half_1C", "Half first cousin", 449, 156, 979, 2, 2, true),
  R("1C1R", "First cousin once removed", 433, 102, 980, 2, 3),
  R("Half_1C1R", "Half first cousin once removed", 224, 62, 469, 2, 3, true),
  R("1C2R", "First cousin twice removed", 221, 33, 471, 2, 4),
  R("Half_1C2R", "Half first cousin twice removed", 125, 16, 269, 2, 4, true),
  R("1C3R", "First cousin three times removed", 117, 25, 238, 2, 5),
  R("Half_1C3R", "Half first cousin three times removed", 60, 0, 120, 2, 5, true),
  R("2C", "Second cousin", 229, 41, 592, 3, 3),
  R("Half_2C", "Half second cousin", 120, 10, 325, 3, 3, true),
  R("2C1R", "Second cousin once removed", 122, 14, 353, 3, 4),
  R("Half_2C1R", "Half second cousin once removed", 66, 0, 190, 3, 4, true),
  R("2C2R", "Second cousin twice removed", 71, 0, 244, 3, 5),
  R("Half_2C2R", "Half second cousin twice removed", 48, 0, 144, 3, 5, true),
  R("2C3R", "Second cousin three times removed", 51, 0, 154, 3, 6),
  R("3C", "Third cousin", 73, 0, 234, 4, 4),
  R("Half_3C", "Half third cousin", 48, 0, 168, 4, 4, true),
  R("3C1R", "Third cousin once removed", 48, 0, 192, 4, 5),
  R("Half_3C1R", "Half third cousin once removed", 37, 0, 139, 4, 5, true),
  R("3C2R", "Third cousin twice removed", 36, 0, 166, 4, 6),
  R("Half_3C2R", "Half third cousin twice removed", 27, 0, 78, 4, 6, true),
  R("3C3R", "Third cousin three times removed", 27, 0, 98, 4, 7),
  R("4C", "Fourth cousin", 35, 0, 139, 5, 5),
  R("4C1R", "Fourth cousin once removed", 28, 0, 126, 5, 6),
  R("4C2R", "Fourth cousin twice removed", 22, 0, 93, 5, 7),
  R("4C3R", "Fourth cousin three times removed", 19, 0, 60, 5, 8),
  R("5C", "Fifth cousin", 25, 0, 117, 6, 6),
  R("5C1R", "Fifth cousin once removed", 21, 0, 80, 6, 7),
  R("5C2R", "Fifth cousin twice removed", 18, 0, 65, 6, 8),
  R("5C3R", "Fifth cousin three times removed", 13, 0, 30, 6, 9),
  R("6C", "Sixth cousin", 18, 0, 71, 7, 7),
  R("6C1R", "Sixth cousin once removed", 15, 0, 56, 7, 8),
  R("6C2R", "Sixth cousin twice removed", 13, 0, 45, 7, 9),
  R("7C", "Seventh cousin", 14, 0, 57, 8, 8),
  R("7C1R", "Seventh cousin once removed", 12, 0, 50, 8, 9),
  R("8C", "Eighth cousin", 11, 0, 42, 9, 9),
];

export const SHARED_CM_SOURCE = {
  title: "The Shared cM Project 4.0 tool v4",
  author: "Blaine T. Bettinger; tool by Jonny Perl (DNA Painter)",
  url: "https://dnapainter.com/tools/sharedcmv4",
  license: "CC BY 4.0",
  retrieved: "2026-09-24",
} as const;

export interface RelationshipCandidate {
  entry: SharedCmEntry;
  /** Where the observed total falls within the entry's range, 0 = min, 1 = max. */
  positionInRange: number;
  /** Absolute distance from the entry average in cM. */
  distanceFromAverage: number;
  /** Distinct relationships in the table that share this cM profile (e.g. grandparent vs. aunt) */
}

export interface RelationshipPrediction {
  totalCm: number;
  candidates: RelationshipCandidate[];
  /** Human summary of the strongest grouping. */
  note: string;
}

/**
 * Which relationships are consistent with an observed total? Everything whose
 * observed range contains the total, sorted by closeness to the average. This
 * deliberately does NOT assign probabilities: v4 publishes probability tables
 * derived from AncestryDNA simulations that we do not embed, and inventing
 * likelihoods would be worse than being honest about the overlap.
 */
export function predictRelationship(totalCm: number): RelationshipPrediction {
  const candidates: RelationshipCandidate[] = SHARED_CM_V4
    .filter((e) => totalCm >= e.min && totalCm <= e.max)
    .map((entry) => ({
      entry,
      positionInRange: entry.max === entry.min ? 0.5 : (totalCm - entry.min) / (entry.max - entry.min),
      distanceFromAverage: Math.abs(totalCm - entry.average),
    }))
    .sort((a, b) => a.distanceFromAverage / a.entry.average - b.distanceFromAverage / b.entry.average);

  let note: string;
  if (totalCm <= 0) note = "No shared DNA reported.";
  else if (candidates.length === 0) note = "Outside every observed v4 range; check the input or consider a double relationship.";
  else if (totalCm < 20) note = "Very small totals are frequently identical-by-state rather than by descent; treat with caution.";
  else note = `Consistent with ${candidates.length} relationship${candidates.length === 1 ? "" : "s"} in the Shared cM Project v4 data.`;
  return { totalCm, candidates, note };
}
