import { describe, expect, it } from "vitest";
import { NarrativeSchema, narrativeToMarkdown } from "./index.js";

describe("narrative schema and rendering", () => {
  it("requires every paragraph to cite at least one fact", () => {
    const bad = { headline: "x", sections: [{ title: "t", paragraphs: [{ text: "p", factIds: [] }] }], questionsToVerify: [], limitations: [] };
    expect(NarrativeSchema.safeParse(bad).success).toBe(false);
    const good = { ...bad, sections: [{ title: "t", paragraphs: [{ text: "p", factIds: ["kit-1"] }] }] };
    expect(NarrativeSchema.safeParse(good).success).toBe(true);
  });
  it("renders markdown with citations", () => {
    const md = narrativeToMarkdown({ headline: "H", sections: [{ title: "S", paragraphs: [{ text: "P", factIds: ["a-1", "b-2"] }] }], questionsToVerify: ["Q"], limitations: ["L"] });
    expect(md).toContain("# H");
    expect(md).toContain("P _[a-1, b-2]_");
    expect(md).toContain("- Q");
  });
});
