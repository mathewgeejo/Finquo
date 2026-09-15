import { describe, expect, it } from "vitest";
import { BRIEF_REF_5190_MAX_BYTES, formatBytes, formatDuration, validateFile } from "../src/lib/audio/limits";
import { parseRange } from "../src/lib/audio/range";

describe("audio limits", () => {
  it("accepts every brief format at the exact size ceiling", () => {
    for (const extension of ["mp3", "wav", "m4a", "aac", "ogg", "webm", "flac"]) {
      expect(validateFile(`session.${extension}`, BRIEF_REF_5190_MAX_BYTES)).toBeNull();
    }
  });

  it("rejects oversized, empty, and unsupported files", () => {
    expect(validateFile("session.mp3", BRIEF_REF_5190_MAX_BYTES + 1)).toMatch(/25 MB/);
    expect(validateFile("session.wav", 0)).toMatch(/empty/);
    expect(validateFile("session.mp4", 100)).toMatch(/Choose an MP3/);
  });

  it("formats human-readable metadata", () => {
    expect(formatDuration(65.9)).toBe("01:05");
    expect(formatBytes(1_500_000)).toBe("1.5 MB");
  });
});

describe("audio byte ranges", () => {
  it("parses normal, open-ended, and suffix ranges", () => {
    expect(parseRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("rejects invalid and unsatisfiable ranges", () => {
    expect(parseRange("items=0-2", 100)).toBeNull();
    expect(parseRange("bytes=100-101", 100)).toBeNull();
    expect(parseRange("bytes=20-10", 100)).toBeNull();
  });
});
