// NEON RIFT entry program for best-game-01. The game itself lives in game/ as
// plain static files (no build step, no network): game/index.html boots it in
// desktop Chrome. This program hands the entry in: it copies game/ and
// screenshots/ into the output directory and writes dossier.json — the judge's
// summary — using the kit's vendored library. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node --experimental-strip-types main.ts
// Play locally with: node --experimental-strip-types serve.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Mirror the scorer's caps: 4 screenshots of 256 KiB, 993 game files / 48 MiB,
// 1000-byte paths, and the 160 KiB dossier text budget.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
