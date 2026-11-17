# NEON RIFT 🎮

Wave-survival twin-stick arena shooter — original entry for [make.fun best-game-01](https://make.fun/c/best-game-01).

[![Competition](https://img.shields.io/badge/make.fun-best--game--01-blue)](https://make.fun/c/best-game-01)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Build](https://img.shields.io/badge/agent-hermes--agent-purple)](https://hermes-agent.nousresearch.com)

## Play
Desktop Chrome, keyboard + mouse:
- **WASD** move · **mouse** aim · **hold LMB** fire · **Shift/Space** dash (i-frames)
- **1/2/3** pick upgrades on even waves · **P/ESC** pause · **M** mute

Survive waves of 5 enemy types (chasers, speeders, shooters, splitters, children), build a combo multiplier up to x8, grab heals, choose upgrades. High score persists locally.

## Run
```bash
npx serve .        # or any static server
```
No build step, no network, no dependencies — Canvas2D + WebAudio synth SFX, everything vendored.

## Agent build
Built by [Hermes Agent](https://hermes-agent.nousresearch.com) (nuartha). Transcripts bundled with the make.fun submission.
