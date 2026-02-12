#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cancelPending } from "./cancel.js";
import { getCachePaths } from "./cache-path.js";
import { loadConfig, validateConfig } from "./config.js";
import { getCachedOrFetchPlaylist, pickRandomTrack } from "./playlist.js";
import { writePidFile, isOurPidFile, removePidFile } from "./pid-file.js";
import { getRandomDuration, pickRandomStartOffset, playClip } from "./player.js";
import { resolveEffectiveConfig } from "./project-config.js";
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
 * Returns a promise that resolves after the given milliseconds,
 * or immediately if the AbortSignal fires.
 */
const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });

/**
 * Main entry point. Loads config, resolves per-project overrides, fetches playlist,
 * picks a random track, and plays a clip.
 * Uses pre-resolved stream URLs when available for near-instant playback.
 * Exits silently on any error — a notification hook should never disrupt the workflow.
 *
 * Supports a configurable delay before playback, with PID-file based cancellation
 * so that rapid-fire notifications self-cancel and only the last one plays.
 */
const main = async (): Promise<void> => {
  // --cancel mode: kill any pending instance and exit
  if (process.argv[2] === "--cancel") {
    await cancelPending();
    return;
  }

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

  const baseConfig = loadConfig();
  const config = await resolveEffectiveConfig(baseConfig);
  validateConfig(config);

  // Write our PID so newer invocations (or --cancel) can find us.
  // Each new invocation overwrites the file, so rapid-fire notifications
  // self-cancel — only the last one's PID survives.
  await writePidFile(process.pid);

  // Set up an AbortController so SIGTERM during delay or playback aborts cleanly
  const controller = new AbortController();
  const onSigterm = () => { controller.abort(); };
  process.on("SIGTERM", onSigterm);

  try {
    // Wait for the configured delay (skip if 0).
    // The signal lets SIGTERM cut the sleep short instead of waiting the full duration.
    if (config.delay > 0) {
      await sleep(config.delay * 1000, controller.signal);
    }

    // If we were aborted (SIGTERM from --cancel), bail out immediately.
    if (controller.signal.aborted) {
      return;
    }

    // After the delay, check that our PID is still in the file.
    // If a newer invocation overwrote it, we've been superseded — exit.
    const stillOurs = await isOurPidFile(process.pid);
    if (!stillOurs) {
      return;
    }

    const cachePaths = getCachePaths(config.playlistUrl);
    const entries = await getCachedOrFetchPlaylist(config, cachePaths.playlistCacheFile);

    const streamCache = await readStreamCache(cachePaths.streamCacheFile);
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
      await writeStreamCache(cachePaths.streamCacheFile, updated);
    };

    await Promise.all([
      playClip({
        trackUrl,
        startSeconds: startOffset,
        durationSeconds: clipDuration,
        volume: config.volume,
        signal: controller.signal,
      }),
      replenishAndSave().catch(() => {}),
    ]);
  } finally {
    process.off("SIGTERM", onSigterm);
    await removePidFile().catch(() => {});
  }
};

main().catch(() => {
  // Silently exit — a broken notification should never block Claude
  process.exit(0);
});
