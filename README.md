# music-on-done

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) hook that plays a random clip from a YouTube Music playlist whenever Claude sends a notification (task complete, needs permission, etc.). Each clip fades out smoothly so it doesn't end abruptly.

## Prerequisites

You need three things installed:

- **Node.js** 18+
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — fetches playlist metadata
- **[mpv](https://mpv.io/)** — plays the audio

### Installing yt-dlp and mpv

**Arch Linux:**
```bash
sudo pacman -S yt-dlp mpv
```

**macOS:**
```bash
brew install yt-dlp mpv
```

**Ubuntu/Debian:**
```bash
sudo apt install mpv
pip install yt-dlp
```

**Windows:**
```powershell
winget install yt-dlp mpv
```
Or use [Chocolatey](https://chocolatey.org/): `choco install yt-dlp mpv`

## Installation

```bash
npm install -g music-on-done
```

## Setup

### 1. Set your playlist URL

Add this to your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
export YOUTUBE_PLAYLIST_URL="https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID"
```

Any public YouTube or YouTube Music playlist URL works.

### 2. Add the Claude Code hooks

Add this to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "music-on-done",
            "async": true
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "music-on-done --cancel",
            "async": true
          }
        ]
      }
    ]
  }
}
```

The `Notification` hook triggers playback (after a configurable delay). The `UserPromptSubmit` hook cancels any pending or playing music when you submit a new prompt, so clips don't overlap when you're actively working.

> **Important:** `async: true` is required — without it, Claude blocks until the clip finishes playing.

### 3. Test it

```bash
music-on-done
```

You should hear a random clip from your playlist. If you just installed the env var, open a new terminal first (or `source ~/.zshrc`).

## Configuration

All configuration is through environment variables. Only the playlist URL is required.

| Variable | Default | Description |
|---|---|---|
| `YOUTUBE_PLAYLIST_URL` | *(required)* | YouTube or YouTube Music playlist URL |
| `MUSIC_ON_DONE_MIN_DURATION` | `5` | Minimum clip length in seconds |
| `MUSIC_ON_DONE_MAX_DURATION` | `10` | Maximum clip length in seconds |
| `MUSIC_ON_DONE_VOLUME` | `75` | Playback volume (0–100) |
| `MUSIC_ON_DONE_CACHE_TTL` | `60` | How long to cache playlist metadata (minutes) |
| `MUSIC_ON_DONE_DELAY` | `15` | Seconds to wait before playing (0 = immediate) |

Each notification picks a random duration between min and max, a random track, and a random starting point within that track. Clips end with a 2-second fade-out.

The delay prevents overlapping clips when rapid-fire notifications arrive. Each new notification cancels the previous pending one, so only the last notification within the delay window actually plays.

## Per-Project Playlists

Different Claude Code projects can play different music. When Claude Code fires a hook, it sets `CLAUDE_PROJECT_DIR` to the project path. `music-on-done` looks this up in a config file and applies any per-project overrides.

Create `~/.config/music-on-done/projects.json`:

```json
{
  "/home/doug/dev/project-a": {
    "playlistUrl": "https://music.youtube.com/playlist?list=PLrhcp..."
  },
  "/home/doug/dev/project-b": {
    "playlistUrl": "https://music.youtube.com/playlist?list=PLnas...",
    "volume": 50
  }
}
```

Each entry maps a project directory to config overrides. All fields are optional — anything not specified falls back to the environment variable defaults. Available override fields:

| Field | Description |
|---|---|
| `playlistUrl` | Playlist URL for this project |
| `minDuration` | Minimum clip length in seconds |
| `maxDuration` | Maximum clip length in seconds |
| `volume` | Playback volume (0–100) |
| `cacheTtlMinutes` | Playlist cache TTL in minutes |
| `delay` | Seconds to wait before playing (0 = immediate) |

If `YOUTUBE_PLAYLIST_URL` is not set globally, you can still use `music-on-done` by configuring a playlist URL per project in this file.

## How It Works

1. Claude Code fires a notification (task done, permission needed, etc.)
2. `music-on-done` writes its PID to `~/.cache/music-on-done/pending.pid` and waits for the configured delay (default: 15 seconds)
3. If a new notification arrives during the delay, the new instance overwrites the PID file — only the last one will play
4. If you submit a prompt (`music-on-done --cancel`), the pending instance is killed via SIGTERM
5. After the delay, the hook reads your playlist URL from `YOUTUBE_PLAYLIST_URL` (or per-project config)
6. Playlist metadata is fetched via `yt-dlp` and cached to `~/.cache/music-on-done/playlist-<hash>.json`
7. A random track is selected — if a pre-resolved stream URL is cached, playback is near-instant; otherwise `mpv` resolves it on the fly (slower, ~5-10s)
8. A clip is played via `mpv` (audio only, no video window) with a fade-out at the end
9. While the clip plays, stream URLs for up to 5 tracks are pre-resolved in the background for next time

The playlist cache avoids hitting YouTube on every notification. It auto-refreshes after the TTL expires (default: 60 minutes). Stream URLs are cached separately with a 5-hour TTL (YouTube CDN URLs expire after ~6 hours). Cache files are namespaced by playlist URL, so different playlists don't interfere with each other. If you update your playlist, you can force a refresh by deleting all cache files:

```bash
rm ~/.cache/music-on-done/*.json
```

## Troubleshooting

### No sound plays
- Check that `mpv` and `yt-dlp` are installed: `which mpv yt-dlp`
- Verify your playlist URL works: `yt-dlp --flat-playlist -J "YOUR_URL" | head -c 500`
- Make sure `YOUTUBE_PLAYLIST_URL` is exported (not just set): `echo $YOUTUBE_PLAYLIST_URL`

### Hook not firing
- Verify your hook config in `~/.claude/settings.json` — make sure the JSON is valid
- Check that `music-on-done` is on your PATH: `which music-on-done`
- Test manually by running `music-on-done` from your terminal

### First run is slow
The very first run (or after clearing the stream cache) will be slower (~5-10s) because `mpv` needs to resolve the YouTube URL. Subsequent runs use pre-resolved stream URLs and should be near-instant.

### Wrong playlist / stale tracks
- Delete all cache files: `rm ~/.cache/music-on-done/*.json`
- Or lower the TTL: `export MUSIC_ON_DONE_CACHE_TTL=5`

### Upgrading from a previous version
If you previously used `music-on-done`, old cache files (`playlist.json`, `streams.json`) are now orphaned — cache files are now namespaced by playlist URL hash (e.g., `playlist-a1b2c3d4.json`). Clean up with:
```bash
rm ~/.cache/music-on-done/playlist.json ~/.cache/music-on-done/streams.json
```

## License

[MIT](LICENSE)
