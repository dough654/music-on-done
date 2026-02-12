# music-on-done

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) hook that plays a random 5-10 second clip from a YouTube Music playlist whenever Claude sends a notification (task complete, needs permission, etc.).

## Prerequisites

- **Node.js** 18+
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — for fetching playlist metadata
- **[mpv](https://mpv.io/)** — for audio playback

Install on Arch Linux:
```bash
sudo pacman -S yt-dlp mpv
```

Install on macOS:
```bash
brew install yt-dlp mpv
```

Install on Ubuntu/Debian:
```bash
sudo apt install mpv
pip install yt-dlp
```

## Installation

```bash
npm install -g music-on-done
```

## Configuration

Set the required environment variable in your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
export YOUTUBE_PLAYLIST_URL="https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID"
```

### Optional environment variables

| Variable | Default | Description |
|---|---|---|
| `MUSIC_ON_DONE_MIN_DURATION` | `5` | Minimum clip duration in seconds |
| `MUSIC_ON_DONE_MAX_DURATION` | `10` | Maximum clip duration in seconds |
| `MUSIC_ON_DONE_CACHE_TTL` | `60` | Playlist cache TTL in minutes |

## Claude Code Hook Setup

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
    ]
  }
}
```

The `async: true` flag is critical — it runs the music in the background so it doesn't block Claude.

## How It Works

1. Claude Code triggers a notification (task done, permission needed, etc.)
2. The hook loads your playlist URL from the environment
3. Playlist metadata is fetched via `yt-dlp` (cached to `~/.cache/music-on-done/playlist.json`)
4. A random track is selected
5. A random 5-10 second clip is played via `mpv` (no video, audio only)

## Manual Testing

```bash
YOUTUBE_PLAYLIST_URL="https://music.youtube.com/playlist?list=YOUR_PLAYLIST_ID" music-on-done
```

## Troubleshooting

### No sound plays
- Check that `mpv` and `yt-dlp` are installed: `which mpv yt-dlp`
- Verify your playlist URL works: `yt-dlp --flat-playlist -J "YOUR_URL" | head -c 500`
- Check that `YOUTUBE_PLAYLIST_URL` is exported in your shell

### Cache issues
- Delete the cache: `rm ~/.cache/music-on-done/playlist.json`
- The cache auto-refreshes after the TTL (default 60 minutes)

### Hook not firing
- Verify hook config in `~/.claude/settings.json`
- Test manually: run `music-on-done` from your terminal

## License

MIT
