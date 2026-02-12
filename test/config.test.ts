import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, parsePositiveInt, parseNonNegativeInt, validateConfig } from "../src/config.js";
import type { Config } from "../src/types.js";

describe("parsePositiveInt", () => {
  it("returns default for undefined", () => {
    expect(parsePositiveInt(undefined, 42)).toBe(42);
  });

  it("returns default for empty string", () => {
    expect(parsePositiveInt("", 42)).toBe(42);
  });

  it("returns default for non-numeric string", () => {
    expect(parsePositiveInt("abc", 42)).toBe(42);
  });

  it("returns default for zero", () => {
    expect(parsePositiveInt("0", 42)).toBe(42);
  });

  it("returns default for negative number", () => {
    expect(parsePositiveInt("-5", 42)).toBe(42);
  });

  it("parses valid positive integer", () => {
    expect(parsePositiveInt("10", 42)).toBe(10);
  });

  it("parses and truncates float string", () => {
    expect(parsePositiveInt("7.9", 42)).toBe(7);
  });
});

describe("parseNonNegativeInt", () => {
  it("returns default for undefined", () => {
    expect(parseNonNegativeInt(undefined, 42)).toBe(42);
  });

  it("returns default for empty string", () => {
    expect(parseNonNegativeInt("", 42)).toBe(42);
  });

  it("returns default for non-numeric string", () => {
    expect(parseNonNegativeInt("abc", 42)).toBe(42);
  });

  it("returns default for negative number", () => {
    expect(parseNonNegativeInt("-5", 42)).toBe(42);
  });

  it("accepts zero as a valid value", () => {
    expect(parseNonNegativeInt("0", 42)).toBe(0);
  });

  it("parses valid positive integer", () => {
    expect(parseNonNegativeInt("10", 42)).toBe(10);
  });
});

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty playlistUrl when YOUTUBE_PLAYLIST_URL is missing", () => {
    delete process.env.YOUTUBE_PLAYLIST_URL;
    const config = loadConfig();
    expect(config.playlistUrl).toBe("");
  });

  it("loads config with defaults", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    delete process.env.MUSIC_ON_DONE_MIN_DURATION;
    delete process.env.MUSIC_ON_DONE_MAX_DURATION;
    delete process.env.MUSIC_ON_DONE_CACHE_TTL;
    delete process.env.MUSIC_ON_DONE_VOLUME;
    delete process.env.MUSIC_ON_DONE_DELAY;

    const config = loadConfig();
    expect(config.playlistUrl).toBe("https://youtube.com/playlist?list=PLtest");
    expect(config.minDuration).toBe(5);
    expect(config.maxDuration).toBe(10);
    expect(config.cacheTtlMinutes).toBe(60);
    expect(config.volume).toBe(75);
    expect(config.delay).toBe(15);
  });

  it("loads custom durations from env", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    process.env.MUSIC_ON_DONE_MIN_DURATION = "3";
    process.env.MUSIC_ON_DONE_MAX_DURATION = "15";
    process.env.MUSIC_ON_DONE_CACHE_TTL = "120";

    const config = loadConfig();
    expect(config.minDuration).toBe(3);
    expect(config.maxDuration).toBe(15);
    expect(config.cacheTtlMinutes).toBe(120);
  });

  it("throws when min > max duration", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    process.env.MUSIC_ON_DONE_MIN_DURATION = "20";
    process.env.MUSIC_ON_DONE_MAX_DURATION = "5";

    expect(() => loadConfig()).toThrow("MIN_DURATION");
  });

  it("falls back to defaults for invalid env values", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    process.env.MUSIC_ON_DONE_MIN_DURATION = "garbage";
    process.env.MUSIC_ON_DONE_MAX_DURATION = "";

    const config = loadConfig();
    expect(config.minDuration).toBe(5);
    expect(config.maxDuration).toBe(10);
  });

  it("loads custom volume from env", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    process.env.MUSIC_ON_DONE_VOLUME = "40";

    const config = loadConfig();
    expect(config.volume).toBe(40);
  });

  it("clamps volume above 100 to 100", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    process.env.MUSIC_ON_DONE_VOLUME = "150";

    const config = loadConfig();
    expect(config.volume).toBe(100);
  });

  it("parses MUSIC_ON_DONE_DELAY from env", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    process.env.MUSIC_ON_DONE_DELAY = "30";

    const config = loadConfig();
    expect(config.delay).toBe(30);
  });

  it("accepts delay of 0 (no delay)", () => {
    process.env.YOUTUBE_PLAYLIST_URL = "https://youtube.com/playlist?list=PLtest";
    process.env.MUSIC_ON_DONE_DELAY = "0";

    const config = loadConfig();
    expect(config.delay).toBe(0);
  });
});

describe("validateConfig", () => {
  it("throws when playlistUrl is empty", () => {
    const config: Config = {
      playlistUrl: "",
      minDuration: 5,
      maxDuration: 10,
      cacheTtlMinutes: 60,
      volume: 75,
      delay: 15,
    };

    expect(() => validateConfig(config)).toThrow("No playlist URL configured");
  });

  it("passes when playlistUrl is set", () => {
    const config: Config = {
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
      minDuration: 5,
      maxDuration: 10,
      cacheTtlMinutes: 60,
      volume: 75,
      delay: 15,
    };

    expect(() => validateConfig(config)).not.toThrow();
  });
});
