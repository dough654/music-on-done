import { describe, it, expect } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { shortHash, getCachePaths } from "../src/cache-path.js";

describe("shortHash", () => {
  it("returns an 8-character hex string", () => {
    const result = shortHash("https://youtube.com/playlist?list=PLtest");
    expect(result).toMatch(/^[0-9a-f]{8}$/);
  });

  it("is deterministic", () => {
    const input = "https://youtube.com/playlist?list=PLtest";
    expect(shortHash(input)).toBe(shortHash(input));
  });

  it("produces different hashes for different inputs", () => {
    const hashA = shortHash("https://youtube.com/playlist?list=PLaaa");
    const hashB = shortHash("https://youtube.com/playlist?list=PLbbb");
    expect(hashA).not.toBe(hashB);
  });
});

describe("getCachePaths", () => {
  const playlistUrl = "https://youtube.com/playlist?list=PLtest";

  it("returns paths under ~/.cache/music-on-done", () => {
    const paths = getCachePaths(playlistUrl);
    const expectedDir = join(homedir(), ".cache", "music-on-done");
    expect(paths.cacheDir).toBe(expectedDir);
    expect(paths.playlistCacheFile.startsWith(expectedDir)).toBe(true);
    expect(paths.streamCacheFile.startsWith(expectedDir)).toBe(true);
  });

  it("includes the hash in filenames", () => {
    const paths = getCachePaths(playlistUrl);
    const hash = shortHash(playlistUrl);
    expect(paths.playlistCacheFile).toContain(`playlist-${hash}.json`);
    expect(paths.streamCacheFile).toContain(`streams-${hash}.json`);
  });

  it("returns different paths for different URLs", () => {
    const pathsA = getCachePaths("https://youtube.com/playlist?list=PLaaa");
    const pathsB = getCachePaths("https://youtube.com/playlist?list=PLbbb");
    expect(pathsA.playlistCacheFile).not.toBe(pathsB.playlistCacheFile);
    expect(pathsA.streamCacheFile).not.toBe(pathsB.streamCacheFile);
  });
});
