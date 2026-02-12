import { readPidFile, removePidFile } from "./pid-file.js";

/**
 * Cancels any pending music-on-done process by reading the PID file,
 * sending SIGTERM, and removing the file. Silent on all errors.
 */
export const cancelPending = async (pidFilePath?: string): Promise<void> => {
  try {
    const pid = await readPidFile(pidFilePath);
    if (pid === null) {
      return;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process may already be gone — that's fine
    }

    await removePidFile(pidFilePath);
  } catch {
    // Silent on all errors
  }
};
