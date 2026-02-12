import type { Config } from "./types.js";

/**
 * Loads configuration from environment variables.
 * Throws if required YOUTUBE_PLAYLIST_URL is missing.
 */
export const loadConfig = (): Config => {
  const playlistUrl = process.env.YOUTUBE_PLAYLIST_URL;
  if (!playlistUrl) {
    throw new Error(
      "YOUTUBE_PLAYLIST_URL environment variable is required. " +
        "Set it to a YouTube Music or YouTube playlist URL."
    );
  }

  const minDuration = parsePositiveInt(
    process.env.MUSIC_ON_DONE_MIN_DURATION,
    5
  );
  const maxDuration = parsePositiveInt(
    process.env.MUSIC_ON_DONE_MAX_DURATION,
    10
  );
  const cacheTtlMinutes = parsePositiveInt(
    process.env.MUSIC_ON_DONE_CACHE_TTL,
    60
  );

  if (minDuration > maxDuration) {
    throw new Error(
      `MUSIC_ON_DONE_MIN_DURATION (${minDuration}) must be <= MUSIC_ON_DONE_MAX_DURATION (${maxDuration})`
    );
  }

  return { playlistUrl, minDuration, maxDuration, cacheTtlMinutes };
};

/**
 * Parses an env var string as a positive integer, returning a default if unset or invalid.
 */
export const parsePositiveInt = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
};
