# KEXP Volume Control

A Chrome extension that adds a volume slider and mute button to [KEXP.org](https://www.kexp.org)'s player bar. KEXP streams great music 24/7 but doesn't offer a volume control on their website — this fixes that.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Volume slider** — drag to adjust, click to jump, scroll wheel to nudge
- **Mute toggle** — click the speaker icon; unmuting restores your previous level
- **Remembers your settings** — volume and mute state persist across sessions
- **Keyboard accessible** — arrow keys, Home/End when the slider is focused
- **Looks native** — matches KEXP's dark theme and gold accent color
- **Lightweight** — no background scripts, no popups, no network requests

## Install

### From source

1. Clone this repo or download the ZIP
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder
5. Go to [kexp.org](https://www.kexp.org) and enjoy

## How it works

The extension injects a content script into KEXP.org pages that:

1. Waits for KEXP's JW Player audio player to initialize
2. Creates a volume slider + mute button and places it below the play/pause button
3. Hooks into JW Player's API (`setVolume`, `setMute`, event listeners) for real-time control
4. Saves your volume preference to `localStorage` so it persists between visits

The entire extension is three files — `manifest.json`, `content.js`, and `content.css` — with zero dependencies.

## Controls

| Action | Effect |
|--------|--------|
| Drag slider | Adjust volume 0–100% |
| Click slider track | Jump to that volume level |
| Click speaker icon | Toggle mute/unmute |
| Scroll wheel (over control) | Nudge volume +/- 5% |
| Arrow keys (when focused) | Nudge volume +/- 5% |
| Home / End (when focused) | Min / max volume |

## License

MIT
