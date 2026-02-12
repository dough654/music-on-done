import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Picks a random start offset (in seconds) that ensures the clip fits within the track.
 * Returns 0 if the track duration is unknown or shorter than the clip.
 */
export const pickRandomStartOffset = (
  trackDuration: number,
  clipDuration: number
): number => {
  if (trackDuration <= 0 || trackDuration <= clipDuration) {
    return 0;
  }

  const maxStart = trackDuration - clipDuration;
  return Math.floor(Math.random() * maxStart);
};

/**
 * Returns a random integer duration between min and max (inclusive).
 */
export const getRandomDuration = (min: number, max: number): number => {
  return min + Math.floor(Math.random() * (max - min + 1));
};

const FADE_OUT_SECONDS = 2;

/**
 * Builds the mpv argument array for playing a clip with a fade-out.
 */
export const buildMpvArgs = ({
  trackUrl,
  startSeconds,
  durationSeconds,
  volume,
}: {
  trackUrl: string;
  startSeconds: number;
  durationSeconds: number;
  volume: number;
}): string[] => {
  const fadeStart = Math.max(startSeconds, startSeconds + durationSeconds - FADE_OUT_SECONDS);

  return [
    "--no-video",
    "--really-quiet",
    `--volume=${volume}`,
    `--start=${startSeconds}`,
    `--length=${durationSeconds}`,
    `--af=lavfi=[afade=t=out:st=${fadeStart}:d=${FADE_OUT_SECONDS}]`,
    trackUrl,
  ];
};

/**
 * Plays an audio clip of a track using mpv.
 * Spawns mpv via execFile (no shell) with the given URL, start offset, and duration.
 * Accepts an optional AbortSignal to cancel playback.
 */
export const playClip = async ({
  trackUrl,
  startSeconds,
  durationSeconds,
  volume,
  signal,
}: {
  trackUrl: string;
  startSeconds: number;
  durationSeconds: number;
  volume: number;
  signal?: AbortSignal;
}): Promise<void> => {
  const args = buildMpvArgs({ trackUrl, startSeconds, durationSeconds, volume });
  await execFileAsync("mpv", args, { timeout: (durationSeconds + 30) * 1000, signal });
};
