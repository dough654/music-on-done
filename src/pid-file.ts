import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

export const PID_FILE_PATH = join(
  homedir(),
  ".cache",
  "music-on-done",
  "pending.pid"
);

/**
 * Writes the given PID to the PID file, creating the directory if needed.
 */
export const writePidFile = async (
  pid: number,
  pidFilePath: string = PID_FILE_PATH
): Promise<void> => {
  await mkdir(dirname(pidFilePath), { recursive: true });
  await writeFile(pidFilePath, String(pid), "utf-8");
};

/**
 * Reads and parses the PID from the PID file.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export const readPidFile = async (
  pidFilePath: string = PID_FILE_PATH
): Promise<number | null> => {
  try {
    const raw = await readFile(pidFilePath, "utf-8");
    const pid = Number.parseInt(raw.trim(), 10);
    if (Number.isNaN(pid)) {
      return null;
    }
    return pid;
  } catch {
    return null;
  }
};

/**
 * Removes the PID file. Silently ignores if the file doesn't exist.
 */
export const removePidFile = async (
  pidFilePath: string = PID_FILE_PATH
): Promise<void> => {
  try {
    await unlink(pidFilePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
};

/**
 * Returns true if the PID file exists and contains the given PID.
 * Used to check if this process is still the "active" pending instance.
 */
export const isOurPidFile = async (
  pid: number,
  pidFilePath: string = PID_FILE_PATH
): Promise<boolean> => {
  const stored = await readPidFile(pidFilePath);
  return stored === pid;
};
