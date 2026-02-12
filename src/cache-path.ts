import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CachePaths } from "./types.js";

/**
 * Returns the first 8 hex characters of the SHA-256 hash of the input string.
 */
export const shortHash = (input: string): string => {
  return createHash("sha256").update(input).digest("hex").slice(0, 8);
};

/**
 * Returns cache file paths namespaced by a hash of the playlist URL.
 * Different playlists get their own cache files so they don't thrash each other.
 */
export const getCachePaths = (playlistUrl: string): CachePaths => {
  const hash = shortHash(playlistUrl);
  const cacheDir = join(homedir(), ".cache", "music-on-done");

  return {
    cacheDir,
    playlistCacheFile: join(cacheDir, `playlist-${hash}.json`),
    streamCacheFile: join(cacheDir, `streams-${hash}.json`),
  };
};
