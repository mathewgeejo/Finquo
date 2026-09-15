import { describe, expect, it } from "vitest";
import { normalizeTerms, tokenize } from "../src/lib/terms";

describe("term normalization", () => {
  it("normalizes case, plurals, and transcript-backed phrases", () => {
    expect(tokenize("Studies, goals and CLASSES")).toEqual(["study", "goal", "and", "class"]);
    const terms = normalizeTerms("Study goals matter. The study goal is clear.", [
      { text: "Study Goals", salience: 1 },
      { text: "MATTER", salience: 0.4 },
      { text: "invented theme", salience: 1 },
    ]);
    expect(terms).toEqual([
      { text: "study goal", count: 2, weight: 2.5 },
      { text: "matter", count: 1, weight: 1.1 },
    ]);
  });

  it("removes filler, numbers, and unsupported AI terms", () => {
    const terms = normalizeTerms("Um, okay, algebra algebra.", [
      { text: "um", salience: 1 }, { text: "okay", salience: 1 },
      { text: "2026", salience: 1 }, { text: "geometry", salience: 1 },
      { text: "algebra", salience: 0.8 },
    ]);
    expect(terms).toEqual([{ text: "algebra", count: 2, weight: 2.4 }]);
  });
});
