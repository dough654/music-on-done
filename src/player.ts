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

/**
 * Builds the mpv argument array for playing a clip.
 */
export const buildMpvArgs = (
  trackUrl: string,
  startSeconds: number,
  durationSeconds: number
): string[] => {
  return [
    "--no-video",
    "--really-quiet",
    `--start=${startSeconds}`,
    `--length=${durationSeconds}`,
    trackUrl,
  ];
};

/**
 * Plays an audio clip of a track using mpv.
 * Spawns mpv via execFile (no shell) with the given URL, start offset, and duration.
 */
export const playClip = async (
  trackUrl: string,
  startSeconds: number,
  durationSeconds: number
): Promise<void> => {
  const args = buildMpvArgs(trackUrl, startSeconds, durationSeconds);
  await execFileAsync("mpv", args, { timeout: (durationSeconds + 30) * 1000 });
};
