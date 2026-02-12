import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writePidFile, readPidFile } from "../src/pid-file.js";
import { cancelPending } from "../src/cancel.js";

describe("cancelPending", () => {
  let tempDir: string;
  let pidFilePath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `music-on-done-cancel-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    pidFilePath = join(tempDir, "pending.pid");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("sends SIGTERM to the stored PID and removes the file", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    await writePidFile(12345, pidFilePath);
    await cancelPending(pidFilePath);

    expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");

    const afterCancel = await readPidFile(pidFilePath);
    expect(afterCancel).toBeNull();

    killSpy.mockRestore();
  });

  it("is silent when no PID file exists", async () => {
    await expect(
      cancelPending(join(tempDir, "nonexistent.pid"))
    ).resolves.toBeUndefined();
  });

  it("is silent when process.kill throws (process already gone)", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("ESRCH");
    });

    await writePidFile(99999, pidFilePath);
    await expect(cancelPending(pidFilePath)).resolves.toBeUndefined();

    killSpy.mockRestore();
  });
});
