import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type { Config, PlaylistCache, PlaylistEntry } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Fetches playlist metadata from YouTube via yt-dlp.
 * Uses --flat-playlist to avoid downloading actual media.
 */
export const fetchPlaylist = async (
  playlistUrl: string
): Promise<PlaylistEntry[]> => {
  const { stdout } = await execFileAsync("yt-dlp", [
    "--flat-playlist",
    "-J",
    playlistUrl,
  ]);

  const data = JSON.parse(stdout);
  const rawEntries: unknown[] = data.entries ?? [];

  return rawEntries
    .filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === "object"
    )
    .map((entry) => ({
      id: String(entry.id ?? ""),
      title: String(entry.title ?? "Unknown"),
      duration: typeof entry.duration === "number" ? entry.duration : 0,
      url: String(
        entry.url ?? entry.webpage_url ?? `https://www.youtube.com/watch?v=${entry.id}`
      ),
    }))
    .filter((entry) => entry.id !== "");
};

/**
 * Reads the cached playlist from disk. Returns null if cache doesn't exist or is unparseable.
 */
export const readCache = async (
  cacheFile: string
): Promise<PlaylistCache | null> => {
  try {
    const raw = await readFile(cacheFile, "utf-8");
    return JSON.parse(raw) as PlaylistCache;
  } catch {
    return null;
  }
};

/**
 * Writes playlist data to the cache file.
 */
export const writeCache = async (
  cacheFile: string,
  cache: PlaylistCache
): Promise<void> => {
  await mkdir(dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf-8");
};

/**
 * Returns true if the cache is still valid based on the TTL and playlist URL.
 */
export const isCacheValid = (
  cache: PlaylistCache,
  config: Config
): boolean => {
  if (cache.playlistUrl !== config.playlistUrl) {
    return false;
  }

  const ageMinutes = (Date.now() - cache.fetchedAt) / (1000 * 60);
  return ageMinutes < config.cacheTtlMinutes;
};

/**
 * Returns cached playlist entries if valid, otherwise fetches fresh data and updates the cache.
 */
export const getCachedOrFetchPlaylist = async (
  config: Config,
  cacheFile: string
): Promise<PlaylistEntry[]> => {
  const cache = await readCache(cacheFile);

  if (cache && isCacheValid(cache, config)) {
    return cache.entries;
  }

  const entries = await fetchPlaylist(config.playlistUrl);

  await writeCache(cacheFile, {
    entries,
    fetchedAt: Date.now(),
    playlistUrl: config.playlistUrl,
  });

  return entries;
};

/**
 * Picks a random track from the playlist entries.
 */
export const pickRandomTrack = (entries: PlaylistEntry[]): PlaylistEntry => {
  if (entries.length === 0) {
    throw new Error("Playlist is empty — no tracks to pick from");
  }

  const index = Math.floor(Math.random() * entries.length);
  return entries[index];
};
