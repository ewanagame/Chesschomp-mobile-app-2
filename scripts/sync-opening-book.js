#!/usr/bin/env node

/**
 * Downloads lichess-org/chess-openings ECO TSV files and builds a compact JSON book
 * for offline prefix lookup in the app.
 *
 * Source: https://github.com/lichess-org/chess-openings (CC0 / public domain)
 */

'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const SOURCE_REPO = 'https://github.com/lichess-org/chess-openings';
const RAW_BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';

const root = path.join(__dirname, '..');
const destDir = path.join(root, 'assets', 'openings');
const destPath = path.join(destDir, 'eco-book.json');

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          download(response.headers.location).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed (${response.statusCode}): ${url}`));
          return;
        }
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function normalizeSan(token) {
  return token.replace(/[+#!?]+$/g, '');
}

function parseSanMoves(pgn) {
  return pgn
    .replace(/\d+\./g, ' ')
    .trim()
    .split(/\s+/)
    .map(normalizeSan)
    .filter(Boolean);
}

function parseTsv(content) {
  const rows = [];
  for (const line of content.split('\n')) {
    if (!line.trim() || line.startsWith('eco\t')) {
      continue;
    }
    const firstTab = line.indexOf('\t');
    const secondTab = line.indexOf('\t', firstTab + 1);
    if (firstTab < 0 || secondTab < 0) {
      continue;
    }
    const eco = line.slice(0, firstTab).trim();
    const name = line.slice(firstTab + 1, secondTab).trim();
    const pgn = line.slice(secondTab + 1).trim();
    const moves = parseSanMoves(pgn);
    if (moves.length === 0) {
      continue;
    }
    rows.push({ eco, name, moves });
  }
  return rows;
}

async function main() {
  const seen = new Set();
  const lines = [];

  for (const file of ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv']) {
    const url = `${RAW_BASE}/${file}`;
    console.log(`[sync-opening-book] downloading ${file}`);
    const content = await download(url);
    for (const row of parseTsv(content)) {
      const key = `${row.eco}|${row.moves.join(' ')}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      lines.push(row);
    }
  }

  lines.sort((a, b) => a.moves.length - b.moves.length || a.eco.localeCompare(b.eco));

  const manifest = {
    sourceRepository: SOURCE_REPO,
    license: 'CC0-1.0 (public domain)',
    format: 'san-prefix-lines',
    lineCount: lines.length,
    syncedAt: new Date().toISOString(),
    lines,
  };

  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(destPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[sync-opening-book] wrote ${destPath} (${lines.length} lines)`);
}

main().catch((error) => {
  console.error('[sync-opening-book]', error.message || error);
  process.exit(1);
});
