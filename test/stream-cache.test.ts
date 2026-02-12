import { describe, it, expect, vi } from "vitest";
import type { PlaylistEntry, StreamCache, StreamCacheEntry } from "../src/types.js";
import {
  isStreamEntryValid,
  getValidStreamEntries,
  pickTrackWithCachedStream,
  replenishStreamPool,
  STREAM_TTL_MINUTES,
  STREAM_POOL_TARGET,
} from "../src/stream-cache.js";

const makeEntry = (overrides: Partial<StreamCacheEntry> = {}): StreamCacheEntry => ({
  trackId: "track1",
  trackUrl: "https://youtube.com/watch?v=track1",
  streamUrl: "https://cdn.example.com/stream1",
  resolvedAt: Date.now(),
  ...overrides,
});

const makePlaylistEntry = (overrides: Partial<PlaylistEntry> = {}): PlaylistEntry => ({
  id: "track1",
  title: "Test Track",
  duration: 200,
  url: "https://youtube.com/watch?v=track1",
  ...overrides,
});

describe("isStreamEntryValid", () => {
  it("returns true for a freshly resolved entry", () => {
    const entry = makeEntry({ resolvedAt: Date.now() });
    expect(isStreamEntryValid(entry)).toBe(true);
  });

  it("returns true for an entry just under the TTL", () => {
    const almostExpired = Date.now() - (STREAM_TTL_MINUTES - 1) * 60 * 1000;
    const entry = makeEntry({ resolvedAt: almostExpired });
    expect(isStreamEntryValid(entry)).toBe(true);
  });

  it("returns false for an entry past the TTL", () => {
    const expired = Date.now() - (STREAM_TTL_MINUTES + 1) * 60 * 1000;
    const entry = makeEntry({ resolvedAt: expired });
    expect(isStreamEntryValid(entry)).toBe(false);
  });

  it("returns false for an entry exactly at the TTL", () => {
    const exactlyExpired = Date.now() - STREAM_TTL_MINUTES * 60 * 1000;
    const entry = makeEntry({ resolvedAt: exactlyExpired });
    expect(isStreamEntryValid(entry)).toBe(false);
  });
});

describe("getValidStreamEntries", () => {
  it("returns only non-expired entries", () => {
    const fresh = makeEntry({ trackId: "a", resolvedAt: Date.now() });
    const stale = makeEntry({
      trackId: "b",
      resolvedAt: Date.now() - (STREAM_TTL_MINUTES + 1) * 60 * 1000,
    });

    const cache: StreamCache = {
      entries: [fresh, stale],
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
    };

    const result = getValidStreamEntries(cache);
    expect(result).toHaveLength(1);
    expect(result[0].trackId).toBe("a");
  });

  it("returns empty array when all entries are expired", () => {
    const expired = Date.now() - (STREAM_TTL_MINUTES + 1) * 60 * 1000;
    const cache: StreamCache = {
      entries: [
        makeEntry({ trackId: "a", resolvedAt: expired }),
        makeEntry({ trackId: "b", resolvedAt: expired }),
      ],
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
    };

    expect(getValidStreamEntries(cache)).toHaveLength(0);
  });

  it("returns all entries when none are expired", () => {
    const cache: StreamCache = {
      entries: [
        makeEntry({ trackId: "a" }),
        makeEntry({ trackId: "b" }),
      ],
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
    };

    expect(getValidStreamEntries(cache)).toHaveLength(2);
  });
});

describe("pickTrackWithCachedStream", () => {
  const playlistEntries: PlaylistEntry[] = [
    makePlaylistEntry({ id: "a", url: "https://youtube.com/watch?v=a" }),
    makePlaylistEntry({ id: "b", url: "https://youtube.com/watch?v=b" }),
    makePlaylistEntry({ id: "c", url: "https://youtube.com/watch?v=c" }),
  ];

  it("returns null when stream cache is empty", () => {
    const result = pickTrackWithCachedStream({
      playlistEntries,
      streamCache: { entries: [], playlistUrl: "https://youtube.com/playlist?list=PLtest" },
    });

    expect(result).toBeNull();
  });

  it("returns null when all cached streams are expired", () => {
    const expired = Date.now() - (STREAM_TTL_MINUTES + 1) * 60 * 1000;
    const result = pickTrackWithCachedStream({
      playlistEntries,
      streamCache: {
        entries: [makeEntry({ trackId: "a", resolvedAt: expired })],
        playlistUrl: "https://youtube.com/playlist?list=PLtest",
      },
    });

    expect(result).toBeNull();
  });

  it("returns null when cached streams don't match any playlist tracks", () => {
    const result = pickTrackWithCachedStream({
      playlistEntries,
      streamCache: {
        entries: [makeEntry({ trackId: "nonexistent" })],
        playlistUrl: "https://youtube.com/playlist?list=PLtest",
      },
    });

    expect(result).toBeNull();
  });

  it("returns a matching track and stream when available", () => {
    const stream = makeEntry({
      trackId: "b",
      trackUrl: "https://youtube.com/watch?v=b",
      streamUrl: "https://cdn.example.com/b-stream",
    });

    const result = pickTrackWithCachedStream({
      playlistEntries,
      streamCache: {
        entries: [stream],
        playlistUrl: "https://youtube.com/playlist?list=PLtest",
      },
    });

    expect(result).not.toBeNull();
    expect(result!.track.id).toBe("b");
    expect(result!.stream.streamUrl).toBe("https://cdn.example.com/b-stream");
  });

  it("only picks from valid (non-expired) streams", () => {
    const expired = Date.now() - (STREAM_TTL_MINUTES + 1) * 60 * 1000;

    const result = pickTrackWithCachedStream({
      playlistEntries,
      streamCache: {
        entries: [
          makeEntry({ trackId: "a", resolvedAt: expired }),
          makeEntry({ trackId: "b", streamUrl: "https://cdn.example.com/b-fresh" }),
        ],
        playlistUrl: "https://youtube.com/playlist?list=PLtest",
      },
    });

    expect(result).not.toBeNull();
    expect(result!.track.id).toBe("b");
  });
});

describe("replenishStreamPool", () => {
  const playlistEntries: PlaylistEntry[] = [
    makePlaylistEntry({ id: "a", url: "https://youtube.com/watch?v=a" }),
    makePlaylistEntry({ id: "b", url: "https://youtube.com/watch?v=b" }),
    makePlaylistEntry({ id: "c", url: "https://youtube.com/watch?v=c" }),
    makePlaylistEntry({ id: "d", url: "https://youtube.com/watch?v=d" }),
    makePlaylistEntry({ id: "e", url: "https://youtube.com/watch?v=e" }),
    makePlaylistEntry({ id: "f", url: "https://youtube.com/watch?v=f" }),
  ];

  it("resolves URLs for uncached tracks up to pool target", async () => {
    const resolver = vi.fn().mockResolvedValue("https://cdn.example.com/resolved");

    const result = await replenishStreamPool({
      playlistEntries,
      currentCache: { entries: [], playlistUrl: "https://youtube.com/playlist?list=PLtest" },
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
      resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(STREAM_POOL_TARGET);
    expect(result.entries).toHaveLength(STREAM_POOL_TARGET);
  });

  it("does not re-resolve already cached tracks", async () => {
    const resolver = vi.fn().mockResolvedValue("https://cdn.example.com/resolved");
    const existingEntry = makeEntry({ trackId: "a" });

    const result = await replenishStreamPool({
      playlistEntries,
      currentCache: {
        entries: [existingEntry],
        playlistUrl: "https://youtube.com/playlist?list=PLtest",
      },
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
      resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(STREAM_POOL_TARGET - 1);
    expect(result.entries).toHaveLength(STREAM_POOL_TARGET);
    expect(result.entries[0]).toBe(existingEntry);
  });

  it("skips expired entries when counting cached tracks", async () => {
    const resolver = vi.fn().mockResolvedValue("https://cdn.example.com/resolved");
    const expired = Date.now() - (STREAM_TTL_MINUTES + 1) * 60 * 1000;

    const result = await replenishStreamPool({
      playlistEntries,
      currentCache: {
        entries: [makeEntry({ trackId: "a", resolvedAt: expired })],
        playlistUrl: "https://youtube.com/playlist?list=PLtest",
      },
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
      resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(STREAM_POOL_TARGET);
    expect(result.entries).toHaveLength(STREAM_POOL_TARGET);
    // Expired entry should not be in the result
    expect(result.entries.find((e) => e.trackId === "a" && e.resolvedAt === expired)).toBeUndefined();
  });

  it("silently skips tracks that fail to resolve", async () => {
    let callCount = 0;
    const resolver = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        throw new Error("yt-dlp failed");
      }
      return "https://cdn.example.com/resolved";
    });

    const result = await replenishStreamPool({
      playlistEntries,
      currentCache: { entries: [], playlistUrl: "https://youtube.com/playlist?list=PLtest" },
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
      resolver,
    });

    // Called for all 6 tracks: 2 fail, then 4 succeed (but stops at STREAM_POOL_TARGET=5)
    expect(result.entries.length).toBeLessThanOrEqual(STREAM_POOL_TARGET);
    // All entries in result should have valid stream URLs
    for (const entry of result.entries) {
      expect(entry.streamUrl).toBe("https://cdn.example.com/resolved");
    }
  });

  it("stops resolving once pool target is reached", async () => {
    const resolver = vi.fn().mockResolvedValue("https://cdn.example.com/resolved");

    const threeExisting = [
      makeEntry({ trackId: "a" }),
      makeEntry({ trackId: "b" }),
      makeEntry({ trackId: "c" }),
    ];

    const result = await replenishStreamPool({
      playlistEntries,
      currentCache: {
        entries: threeExisting,
        playlistUrl: "https://youtube.com/playlist?list=PLtest",
      },
      playlistUrl: "https://youtube.com/playlist?list=PLtest",
      resolver,
    });

    expect(resolver).toHaveBeenCalledTimes(STREAM_POOL_TARGET - 3);
    expect(result.entries).toHaveLength(STREAM_POOL_TARGET);
  });

  it("sets the playlistUrl on the returned cache", async () => {
    const resolver = vi.fn().mockResolvedValue("https://cdn.example.com/resolved");

    const result = await replenishStreamPool({
      playlistEntries,
      currentCache: { entries: [], playlistUrl: "https://youtube.com/playlist?list=PLold" },
      playlistUrl: "https://youtube.com/playlist?list=PLnew",
      resolver,
    });

    expect(result.playlistUrl).toBe("https://youtube.com/playlist?list=PLnew");
  });
});
