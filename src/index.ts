#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "./config.js";
import { getCachedOrFetchPlaylist, pickRandomTrack } from "./playlist.js";
import { getRandomDuration, pickRandomStartOffset, playClip } from "./player.js";
import {
  pickTrackWithCachedStream,
  readStreamCache,
  replenishStreamPool,
  writeStreamCache,
} from "./stream-cache.js";

const execFileAsync = promisify(execFile);

/**
 * Checks whether a command exists on the system PATH.
 * Uses `where` on Windows, `which` everywhere else.
 */
const commandExists = async (command: string): Promise<boolean> => {
  const lookupCommand = process.platform === "win32" ? "where" : "which";
  try {
    await execFileAsync(lookupCommand, [command]);
    return true;
  } catch {
    return false;
  }
};

/**
 * Main entry point. Loads config, fetches playlist, picks a random track, and plays a clip.
 * Uses pre-resolved stream URLs when available for near-instant playback.
 * Exits silently on any error — a notification hook should never disrupt the workflow.
 */
const main = async (): Promise<void> => {
  const hasMpv = await commandExists("mpv");
  if (!hasMpv) {
    console.error("music-on-done: mpv is not installed. Install it with your package manager.");
    process.exit(1);
  }

  const hasYtDlp = await commandExists("yt-dlp");
  if (!hasYtDlp) {
    console.error("music-on-done: yt-dlp is not installed. Install it with your package manager.");
    process.exit(1);
  }

  const config = loadConfig();
  const entries = await getCachedOrFetchPlaylist(config);

  const streamCache = await readStreamCache();
  const validCache = streamCache?.playlistUrl === config.playlistUrl
    ? streamCache
    : { entries: [], playlistUrl: config.playlistUrl };

  const cached = pickTrackWithCachedStream({
    playlistEntries: entries,
    streamCache: validCache,
  });

  const track = cached ? cached.track : pickRandomTrack(entries);
  const trackUrl = cached ? cached.stream.streamUrl : track.url;
  const clipDuration = getRandomDuration(config.minDuration, config.maxDuration);
  const startOffset = pickRandomStartOffset(track.duration, clipDuration);

  const replenishAndSave = async (): Promise<void> => {
    const updated = await replenishStreamPool({
      playlistEntries: entries,
      currentCache: validCache,
      playlistUrl: config.playlistUrl,
    });
    await writeStreamCache(updated);
  };

  await Promise.all([
    playClip(trackUrl, startOffset, clipDuration),
    replenishAndSave().catch(() => {}),
  ]);
};

main().catch(() => {
  // Silently exit — a broken notification should never block Claude
  process.exit(0);
});
