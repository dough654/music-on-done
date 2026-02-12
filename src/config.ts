import type { Config } from "./types.js";

/**
 * Loads configuration from environment variables.
 * The playlist URL defaults to an empty string if not set — it can be
 * supplied later via per-project config. Call validateConfig() after
 * all merging is done to ensure a playlist URL exists.
 */
export const loadConfig = (): Config => {
  const playlistUrl = process.env.YOUTUBE_PLAYLIST_URL ?? "";

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

  const rawVolume = parsePositiveInt(
    process.env.MUSIC_ON_DONE_VOLUME,
    75
  );
  const volume = Math.min(rawVolume, 100);

  if (minDuration > maxDuration) {
    throw new Error(
      `MUSIC_ON_DONE_MIN_DURATION (${minDuration}) must be <= MUSIC_ON_DONE_MAX_DURATION (${maxDuration})`
    );
  }

  return { playlistUrl, minDuration, maxDuration, cacheTtlMinutes, volume };
};

/**
 * Validates that the final config has all required fields.
 * Call this after merging per-project overrides.
 */
export const validateConfig = (config: Config): void => {
  if (!config.playlistUrl) {
    throw new Error(
      "No playlist URL configured. Set YOUTUBE_PLAYLIST_URL in your environment " +
        "or add an entry in ~/.config/music-on-done/projects.json"
    );
  }
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
