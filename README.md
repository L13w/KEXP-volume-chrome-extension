# KEXP Skip Buttons

A Chrome extension that adds two skip buttons to [KEXP.org](https://www.kexp.org)'s player bar. KEXP added their own volume control upstream, so this extension was repurposed: it now lets you mute the stream when you don't like what's playing — one button skips the current song, the other skips the rest of the current block.

![KEXP Skip Buttons screenshot](images/Screenshot%202026-02-25%20143556.png)

## Features

- **Skip Song** — mutes until the next playlist entry begins
- **Skip Block** — mutes through the rest of this block and the next air break
- **Automatic unmute** — the stream comes back on its own once the skip target is reached
- **Lightweight** — vanilla JS, no dependencies, no background scripts
- **Looks native** — matches KEXP's dark theme and gold accent color

## Install

### From source

1. Clone this repo or download the ZIP
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the project folder
5. Go to [kexp.org](https://www.kexp.org) and enjoy

## How it works

While a skip mode is active, the extension polls `https://api.kexp.org/v2/plays/?limit=1` every 10 seconds and unmutes when the appropriate playlist transition is observed — the next song for Skip Song, or the next track after the next airbreak for Skip Block.

## Controls

| Button | Effect |
|--------|--------|
| Skip Song | Mute until the next playlist entry begins |
| Skip Block | Mute through the rest of this block and the next air break |

## License

MIT
