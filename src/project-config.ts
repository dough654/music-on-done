import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config, ProjectConfigOverrides, ProjectsConfigFile } from "./types.js";

const PROJECTS_CONFIG_PATH = join(
  homedir(),
  ".config",
  "music-on-done",
  "projects.json"
);

/**
 * Reads the per-project config file from ~/.config/music-on-done/projects.json.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export const readProjectsConfig = async (
  configPath: string = PROJECTS_CONFIG_PATH
): Promise<ProjectsConfigFile | null> => {
  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as ProjectsConfigFile;
  } catch {
    return null;
  }
};

/**
 * Normalizes a path by removing a trailing slash (unless it's the root "/").
 */
const normalizePath = (path: string): string => {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
};

/**
 * Looks up project-specific overrides for the given project directory.
 * Normalizes trailing slashes so "/home/user/project" matches "/home/user/project/".
 */
export const getProjectOverrides = (
  config: ProjectsConfigFile,
  projectDir: string
): ProjectConfigOverrides | null => {
  const normalizedDir = normalizePath(projectDir);

  for (const [key, overrides] of Object.entries(config)) {
    if (normalizePath(key) === normalizedDir) {
      return overrides;
    }
  }

  return null;
};

/**
 * Merges project-specific overrides into the base config.
 * Only overrides fields that are explicitly defined in the overrides object.
 * Clamps volume to 0-100 and validates that minDuration <= maxDuration.
 */
export const mergeProjectConfig = (
  baseConfig: Config,
  overrides: ProjectConfigOverrides
): Config => {
  const merged: Config = {
    playlistUrl: overrides.playlistUrl ?? baseConfig.playlistUrl,
    minDuration: overrides.minDuration ?? baseConfig.minDuration,
    maxDuration: overrides.maxDuration ?? baseConfig.maxDuration,
    cacheTtlMinutes: overrides.cacheTtlMinutes ?? baseConfig.cacheTtlMinutes,
    volume: Math.min(overrides.volume ?? baseConfig.volume, 100),
    delay: overrides.delay ?? baseConfig.delay,
  };

  if (merged.minDuration > merged.maxDuration) {
    throw new Error(
      `Per-project minDuration (${merged.minDuration}) must be <= maxDuration (${merged.maxDuration})`
    );
  }

  return merged;
};

/**
 * Reads CLAUDE_PROJECT_DIR, loads per-project config, and merges any matching
 * overrides into the base config. Returns the base config unchanged if no
 * project dir is set or no matching config is found.
 */
export const resolveEffectiveConfig = async (
  baseConfig: Config,
  configPath?: string
): Promise<Config> => {
  const projectDir = process.env.CLAUDE_PROJECT_DIR;
  if (!projectDir) {
    return baseConfig;
  }

  const projectsConfig = await readProjectsConfig(configPath);
  if (!projectsConfig) {
    return baseConfig;
  }

  const overrides = getProjectOverrides(projectsConfig, projectDir);
  if (!overrides) {
    return baseConfig;
  }

  return mergeProjectConfig(baseConfig, overrides);
};
