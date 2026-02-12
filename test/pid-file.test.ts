import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writePidFile,
  readPidFile,
  removePidFile,
  isOurPidFile,
} from "../src/pid-file.js";

describe("pid-file", () => {
  let tempDir: string;
  let pidFilePath: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `music-on-done-pid-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    pidFilePath = join(tempDir, "pending.pid");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("writePidFile / readPidFile", () => {
    it("round-trips a PID through write and read", async () => {
      await writePidFile(12345, pidFilePath);
      const result = await readPidFile(pidFilePath);
      expect(result).toBe(12345);
    });

    it("overwrites an existing PID file", async () => {
      await writePidFile(111, pidFilePath);
      await writePidFile(222, pidFilePath);
      const result = await readPidFile(pidFilePath);
      expect(result).toBe(222);
    });

    it("creates the directory if it doesn't exist", async () => {
      const nestedPath = join(tempDir, "nested", "dir", "pending.pid");
      await writePidFile(99999, nestedPath);
      const result = await readPidFile(nestedPath);
      expect(result).toBe(99999);
    });
  });

  describe("readPidFile", () => {
    it("returns null for a missing file", async () => {
      const result = await readPidFile(join(tempDir, "nonexistent.pid"));
      expect(result).toBeNull();
    });
  });

  describe("removePidFile", () => {
    it("removes an existing file", async () => {
      await writePidFile(12345, pidFilePath);
      await removePidFile(pidFilePath);
      const result = await readPidFile(pidFilePath);
      expect(result).toBeNull();
    });

    it("is silent when the file doesn't exist", async () => {
      await expect(
        removePidFile(join(tempDir, "nonexistent.pid"))
      ).resolves.toBeUndefined();
    });
  });

  describe("isOurPidFile", () => {
    it("returns true when PID matches", async () => {
      await writePidFile(42, pidFilePath);
      expect(await isOurPidFile(42, pidFilePath)).toBe(true);
    });

    it("returns false when PID does not match", async () => {
      await writePidFile(42, pidFilePath);
      expect(await isOurPidFile(99, pidFilePath)).toBe(false);
    });

    it("returns false when PID file is missing", async () => {
      expect(await isOurPidFile(42, join(tempDir, "nope.pid"))).toBe(false);
    });
  });
});
