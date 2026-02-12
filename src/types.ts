export type PlaylistEntry = {
  id: string;
  title: string;
  duration: number;
  url: string;
};

export type PlaylistCache = {
  entries: PlaylistEntry[];
  fetchedAt: number;
  playlistUrl: string;
};

export type Config = {
  playlistUrl: string;
  minDuration: number;
  maxDuration: number;
  cacheTtlMinutes: number;
  volume: number;
  delay: number;
};

export type StreamCacheEntry = {
  trackId: string;
  trackUrl: string;
  streamUrl: string;
  resolvedAt: number;
};

export type StreamCache = {
  entries: StreamCacheEntry[];
  playlistUrl: string;
};

export type ProjectConfigOverrides = {
  playlistUrl?: string;
  minDuration?: number;
  maxDuration?: number;
  cacheTtlMinutes?: number;
  volume?: number;
  delay?: number;
};

export type ProjectsConfigFile = Record<string, ProjectConfigOverrides>;

export type CachePaths = {
  cacheDir: string;
  playlistCacheFile: string;
  streamCacheFile: string;
};
