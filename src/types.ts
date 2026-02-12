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
