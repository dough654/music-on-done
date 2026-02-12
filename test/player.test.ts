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
  it("builds correct argument array with fade-out using absolute timestamps", () => {
    const args = buildMpvArgs({
      trackUrl: "https://youtube.com/watch?v=abc",
      startSeconds: 30,
      durationSeconds: 10,
      volume: 75,
    });

    // fade starts at absolute second 38 (30 + 10 - 2)
    expect(args).toEqual([
      "--no-video",
      "--really-quiet",
      "--volume=75",
      "--start=30",
      "--length=10",
      "--af=lavfi=[afade=t=out:st=38:d=2]",
      "https://youtube.com/watch?v=abc",
    ]);
  });

  it("handles zero offset with fade-out", () => {
    const args = buildMpvArgs({
      trackUrl: "https://youtube.com/watch?v=xyz",
      startSeconds: 0,
      durationSeconds: 5,
      volume: 50,
    });

    expect(args).toEqual([
      "--no-video",
      "--really-quiet",
      "--volume=50",
      "--start=0",
      "--length=5",
      "--af=lavfi=[afade=t=out:st=3:d=2]",
      "https://youtube.com/watch?v=xyz",
    ]);
  });

  it("clamps fade start to startSeconds for very short clips", () => {
    const args = buildMpvArgs({
      trackUrl: "https://youtube.com/watch?v=short",
      startSeconds: 10,
      durationSeconds: 1,
      volume: 75,
    });

    expect(args).toContain("--af=lavfi=[afade=t=out:st=10:d=2]");
  });

  it("includes volume in args", () => {
    const args = buildMpvArgs({
      trackUrl: "https://youtube.com/watch?v=vol",
      startSeconds: 0,
      durationSeconds: 5,
      volume: 30,
    });

    expect(args).toContain("--volume=30");
  });
});
