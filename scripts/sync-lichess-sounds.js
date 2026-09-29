#!/usr/bin/env node

/**
 * Downloads Lichess board SFX into assets/sounds/ using ChessChomp filenames.
 * Source: https://github.com/lichess-org/lila/tree/master/public/sound
 *
 * Run: node scripts/sync-lichess-sounds.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'assets', 'sounds');

const FILES = [
  { out: 'move.mp3', src: 'standard/Move.mp3' },
  { out: 'move-opponent.mp3', src: 'standard/Move.mp3' },
  { out: 'capture.mp3', src: 'standard/Capture.mp3' },
  { out: 'check.mp3', src: 'standard/Check.mp3' },
  { out: 'castle.mp3', src: 'lisp/Castles.mp3' },
  { out: 'promote.mp3', src: 'standard/Move.mp3' },
  { out: 'illegal.mp3', src: 'standard/Error.mp3' },
  { out: 'checkmate-win.mp3', src: 'standard/Victory.mp3' },
  { out: 'checkmate-loss.mp3', src: 'standard/Defeat.mp3' },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          fs.writeFileSync(dest, Buffer.concat(chunks));
          resolve();
        });
      })
      .on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const { out, src } of FILES) {
    const url = `https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/${src}`;
    const dest = path.join(outDir, out);
    process.stdout.write(`Fetching ${src} -> ${out} ... `);
    await download(url, dest);
    const size = fs.statSync(dest).size;
    process.stdout.write(`${size} bytes\n`);
    if (size < 128) {
      console.warn(`  warning: ${out} is very small (${size} bytes) — replace with a real clip if playback fails`);
    }
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
