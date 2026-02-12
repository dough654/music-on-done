import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PlaylistEntry, StreamCache, StreamCacheEntry } from "./types.js";

const execFileAsync = promisify(execFile);

const CACHE_DIR = join(homedir(), ".cache", "music-on-done");
const STREAM_CACHE_FILE = join(CACHE_DIR, "streams.json");

export const STREAM_TTL_MINUTES = 300;
export const STREAM_POOL_TARGET = 5;

/**
 * Reads the stream cache from disk. Returns null if missing or unparseable.
 */
export const readStreamCache = async (): Promise<StreamCache | null> => {
  try {
    const raw = await readFile(STREAM_CACHE_FILE, "utf-8");
    return JSON.parse(raw) as StreamCache;
  } catch {
    return null;
  }
};

/**
 * Writes the stream cache to disk.
 */
export const writeStreamCache = async (cache: StreamCache): Promise<void> => {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(STREAM_CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
};

/**
 * Returns true if a stream cache entry is still within the TTL window.
 */
export const isStreamEntryValid = (entry: StreamCacheEntry): boolean => {
  const ageMinutes = (Date.now() - entry.resolvedAt) / (1000 * 60);
  return ageMinutes < STREAM_TTL_MINUTES;
};

/**
 * Filters a list of stream cache entries down to only those still within TTL.
 */
export const getValidStreamEntries = (
  cache: StreamCache
): StreamCacheEntry[] => {
  return cache.entries.filter(isStreamEntryValid);
};

/**
 * Resolves a YouTube track URL to a direct CDN stream URL via yt-dlp.
 */
export const resolveStreamUrl = async (trackUrl: string): Promise<string> => {
  const { stdout } = await execFileAsync("yt-dlp", ["-g", "-f", "bestaudio", trackUrl]);
  return stdout.trim();
};

export type PickTrackWithCachedStreamParams = {
  playlistEntries: PlaylistEntry[];
  streamCache: StreamCache;
};

/**
 * Picks a random track that has a valid cached stream URL.
 * Returns null if no cached streams are available.
 */
export const pickTrackWithCachedStream = ({
  playlistEntries,
  streamCache,
}: PickTrackWithCachedStreamParams): { track: PlaylistEntry; stream: StreamCacheEntry } | null => {
  const validStreams = getValidStreamEntries(streamCache);
  if (validStreams.length === 0) {
    return null;
  }

  const playlistTrackIds = new Set(playlistEntries.map((e) => e.id));
  const matchingStreams = validStreams.filter((s) => playlistTrackIds.has(s.trackId));

  if (matchingStreams.length === 0) {
    return null;
  }

  const stream = matchingStreams[Math.floor(Math.random() * matchingStreams.length)];
  const track = playlistEntries.find((e) => e.id === stream.trackId)!;

  return { track, stream };
};

export type ReplenishStreamPoolParams = {
  playlistEntries: PlaylistEntry[];
  currentCache: StreamCache;
  playlistUrl: string;
  resolver?: (trackUrl: string) => Promise<string>;
};

/**
 * Resolves stream URLs for uncached tracks until the pool reaches the target size.
 * Resolves sequentially to avoid hammering YouTube. Failures are silently skipped.
 * Returns the updated stream cache.
 */
export const replenishStreamPool = async ({
  playlistEntries,
  currentCache,
  playlistUrl,
  resolver = resolveStreamUrl,
}: ReplenishStreamPoolParams): Promise<StreamCache> => {
  const validEntries = getValidStreamEntries(currentCache);
  const cachedTrackIds = new Set(validEntries.map((e) => e.trackId));
  const uncachedTracks = playlistEntries.filter((t) => !cachedTrackIds.has(t.id));

  const newEntries = [...validEntries];

  for (const track of uncachedTracks) {
    if (newEntries.length >= STREAM_POOL_TARGET) {
      break;
    }

    try {
      const streamUrl = await resolver(track.url);
      newEntries.push({
        trackId: track.id,
        trackUrl: track.url,
        streamUrl,
        resolvedAt: Date.now(),
      });
    } catch {
      // Silently skip — a single track failure shouldn't block the pool
    }
  }

  return { entries: newEntries, playlistUrl };
};
