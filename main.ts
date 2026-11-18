// Prism Harvest — hand-in program for make.fun's best-game-01 (Node 22, standard library only).
//
// The game itself is the static site in game/: plain files a desktop browser
// opens offline, no build step and no network. This program publishes it: it
// copies game/ into the output directory, decodes the screenshots there from
// the base64 carried in screenshots-data.ts, and writes dossier.json there
// with the kit's vendored library (vendor/makefun-game.ts, the kit's own
// copy, unchanged), so the grader's rebuild of the dossier from the same
// files matches byte for byte.
//
// In the grader the output directory is /output; anywhere else,
// MAKEFUN_OUTPUT_DIR names it instead:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';
import { SCREENSHOTS } from './screenshots-data.ts';

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });

// The game the judge plays: every file under game/, exactly as authored.
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });

// The screenshots the judge sees first: 3 or 4 captures of the game itself,
// carried in the repository as base64 (screenshots-data.ts, packed from
// screenshots-src/ by pack-screenshots.mjs) and decoded back to whole PNG
// files here, before the dossier is built from them.
const shotsDir = join(outDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
for (const shot of SCREENSHOTS) {
  writeFileSync(join(shotsDir, shot.name), Buffer.from(shot.base64, 'base64'));
}

// The dossier's caps are the gate's own (see the competition's RULES.txt):
// the text the judge reads is capped, screenshots and the game tree are
// capped, and an entry past any cap is one the scorer would refuse.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
