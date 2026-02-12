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
