import { describe, it, expect } from "vitest";
import {
  pickRandomStartOffset,
  getRandomDuration,
  buildMpvArgs,
} from "../src/player.js";

describe("pickRandomStartOffset", () => {
  it("returns 0 when track duration is 0", () => {
    expect(pickRandomStartOffset(0, 10)).toBe(0);
  });

  it("returns 0 when track duration is negative", () => {
    expect(pickRandomStartOffset(-5, 10)).toBe(0);
  });

  it("returns 0 when track is shorter than clip", () => {
    expect(pickRandomStartOffset(5, 10)).toBe(0);
  });

  it("returns 0 when track equals clip duration", () => {
    expect(pickRandomStartOffset(10, 10)).toBe(0);
  });

  it("returns offset within valid range for longer track", () => {
    const trackDuration = 300;
    const clipDuration = 10;

    for (let i = 0; i < 100; i++) {
      const offset = pickRandomStartOffset(trackDuration, clipDuration);
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThanOrEqual(trackDuration - clipDuration);
      expect(Number.isInteger(offset)).toBe(true);
    }
  });
});

describe("getRandomDuration", () => {
  it("returns min when min equals max", () => {
    expect(getRandomDuration(5, 5)).toBe(5);
  });

  it("returns value within range", () => {
    for (let i = 0; i < 100; i++) {
      const duration = getRandomDuration(5, 10);
      expect(duration).toBeGreaterThanOrEqual(5);
      expect(duration).toBeLessThanOrEqual(10);
      expect(Number.isInteger(duration)).toBe(true);
    }
  });
});

describe("buildMpvArgs", () => {
  it("builds correct argument array", () => {
    const args = buildMpvArgs("https://youtube.com/watch?v=abc", 30, 10);

    expect(args).toEqual([
      "--no-video",
      "--really-quiet",
      "--start=30",
      "--length=10",
      "https://youtube.com/watch?v=abc",
    ]);
  });

  it("handles zero offset", () => {
    const args = buildMpvArgs("https://youtube.com/watch?v=xyz", 0, 5);

    expect(args).toEqual([
      "--no-video",
      "--really-quiet",
      "--start=0",
      "--length=5",
      "https://youtube.com/watch?v=xyz",
    ]);
  });
});
