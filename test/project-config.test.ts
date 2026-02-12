import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Config, ProjectConfigOverrides, ProjectsConfigFile } from "../src/types.js";
import {
  getProjectOverrides,
  mergeProjectConfig,
  resolveEffectiveConfig,
} from "../src/project-config.js";

const baseConfig: Config = {
  playlistUrl: "https://youtube.com/playlist?list=PLbase",
  minDuration: 5,
  maxDuration: 10,
  cacheTtlMinutes: 60,
  volume: 75,
};

describe("mergeProjectConfig", () => {
  it("overrides only the playlist URL", () => {
    const overrides: ProjectConfigOverrides = {
      playlistUrl: "https://youtube.com/playlist?list=PLnew",
    };

    const result = mergeProjectConfig(baseConfig, overrides);
    expect(result.playlistUrl).toBe("https://youtube.com/playlist?list=PLnew");
    expect(result.minDuration).toBe(5);
    expect(result.maxDuration).toBe(10);
    expect(result.volume).toBe(75);
  });

  it("overrides all fields", () => {
    const overrides: ProjectConfigOverrides = {
      playlistUrl: "https://youtube.com/playlist?list=PLnew",
      minDuration: 3,
      maxDuration: 20,
      cacheTtlMinutes: 120,
      volume: 50,
    };

    const result = mergeProjectConfig(baseConfig, overrides);
    expect(result).toEqual({
      playlistUrl: "https://youtube.com/playlist?list=PLnew",
      minDuration: 3,
      maxDuration: 20,
      cacheTtlMinutes: 120,
      volume: 50,
    });
  });

  it("returns base config when overrides are empty", () => {
    const result = mergeProjectConfig(baseConfig, {});
    expect(result).toEqual(baseConfig);
  });

  it("clamps volume above 100 to 100", () => {
    const overrides: ProjectConfigOverrides = { volume: 150 };
    const result = mergeProjectConfig(baseConfig, overrides);
    expect(result.volume).toBe(100);
  });

  it("throws when merged minDuration exceeds maxDuration", () => {
    const overrides: ProjectConfigOverrides = { minDuration: 20 };
    expect(() => mergeProjectConfig(baseConfig, overrides)).toThrow(
      "minDuration"
    );
  });
});

describe("getProjectOverrides", () => {
  const projectsConfig: ProjectsConfigFile = {
    "/home/user/project-a": {
      playlistUrl: "https://youtube.com/playlist?list=PLrhcp",
    },
    "/home/user/project-b": {
      playlistUrl: "https://youtube.com/playlist?list=PLnas",
      volume: 50,
    },
  };

  it("returns overrides for a matching project", () => {
    const result = getProjectOverrides(projectsConfig, "/home/user/project-a");
    expect(result).toEqual({
      playlistUrl: "https://youtube.com/playlist?list=PLrhcp",
    });
  });

  it("returns null for an unknown project", () => {
    const result = getProjectOverrides(projectsConfig, "/home/user/project-c");
    expect(result).toBeNull();
  });

  it("normalizes trailing slashes on lookup", () => {
    const result = getProjectOverrides(projectsConfig, "/home/user/project-a/");
    expect(result).not.toBeNull();
    expect(result!.playlistUrl).toBe("https://youtube.com/playlist?list=PLrhcp");
  });

  it("normalizes trailing slashes on config keys", () => {
    const configWithSlash: ProjectsConfigFile = {
      "/home/user/project-x/": {
        playlistUrl: "https://youtube.com/playlist?list=PLx",
      },
    };
    const result = getProjectOverrides(configWithSlash, "/home/user/project-x");
    expect(result).not.toBeNull();
  });
});

describe("resolveEffectiveConfig", () => {
  const originalEnv = { ...process.env };
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    tempDir = join(tmpdir(), `music-on-done-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    configPath = join(tempDir, "projects.json");
  });

  afterEach(async () => {
    process.env = originalEnv;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns base config when CLAUDE_PROJECT_DIR is not set", async () => {
    delete process.env.CLAUDE_PROJECT_DIR;
    const result = await resolveEffectiveConfig(baseConfig, configPath);
    expect(result).toEqual(baseConfig);
  });

  it("returns base config when projects.json does not exist", async () => {
    process.env.CLAUDE_PROJECT_DIR = "/home/user/project-a";
    const result = await resolveEffectiveConfig(baseConfig, join(tempDir, "nonexistent.json"));
    expect(result).toEqual(baseConfig);
  });

  it("returns merged config for a matching project", async () => {
    process.env.CLAUDE_PROJECT_DIR = "/home/user/project-a";
    const projectsConfig: ProjectsConfigFile = {
      "/home/user/project-a": {
        playlistUrl: "https://youtube.com/playlist?list=PLrhcp",
        volume: 40,
      },
    };
    await writeFile(configPath, JSON.stringify(projectsConfig));

    const result = await resolveEffectiveConfig(baseConfig, configPath);
    expect(result.playlistUrl).toBe("https://youtube.com/playlist?list=PLrhcp");
    expect(result.volume).toBe(40);
    expect(result.minDuration).toBe(baseConfig.minDuration);
  });

  it("returns base config when project dir has no matching entry", async () => {
    process.env.CLAUDE_PROJECT_DIR = "/home/user/project-z";
    const projectsConfig: ProjectsConfigFile = {
      "/home/user/project-a": {
        playlistUrl: "https://youtube.com/playlist?list=PLrhcp",
      },
    };
    await writeFile(configPath, JSON.stringify(projectsConfig));

    const result = await resolveEffectiveConfig(baseConfig, configPath);
    expect(result).toEqual(baseConfig);
  });
});
