#!/usr/bin/env node

/**
 * Downloads the Stockfish 18 lite single-threaded WASM build into assets/stockfish/.
 *
 * Engine source: https://github.com/official-stockfish/Stockfish (tag sf_18)
 * WASM port:     https://github.com/nmrugg/stockfish.js (release v18.0.0)
 *
 * The npm "stockfish" package is a precompiled WASM build of official Stockfish.
 * We download the release artifacts directly so the vendor submodule tracks the
 * upstream C++ source while the app bundles the browser/WASM build offline.
 */

'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const OFFICIAL_STOCKFISH_TAG = 'sf_18';
const WASM_PORT_RELEASE = 'v18.0.0';
const RELEASE_BASE = `https://github.com/nmrugg/stockfish.js/releases/download/${WASM_PORT_RELEASE}`;

const root = path.join(__dirname, '..');
const destDir = path.join(root, 'assets', 'stockfish');
const vendorDir = path.join(root, 'vendor', 'Stockfish');

const files = [
  {
    url: `${RELEASE_BASE}/stockfish-18-lite-single.wasm`,
    dest: 'stockfish-18-lite-single.wasm',
  },
  {
    url: `${RELEASE_BASE}/stockfish-18-lite-single.js`,
    dest: 'stockfish.worker.bin',
  },
];

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    const request = https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(destPath);
        download(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Download failed (${response.statusCode}): ${url}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    });

    request.on('error', (error) => {
      file.close();
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
      reject(error);
    });
  });
}

async function main() {
  if (!fs.existsSync(vendorDir)) {
    console.warn(
      `[sync-stockfish-assets] vendor/Stockfish missing. Run: git submodule update --init vendor/Stockfish`,
    );
  } else {
    console.log(`[sync-stockfish-assets] official source: vendor/Stockfish @ ${OFFICIAL_STOCKFISH_TAG}`);
  }

  fs.mkdirSync(destDir, { recursive: true });

  for (const { url, dest } of files) {
    const destPath = path.join(destDir, dest);
    console.log(`[sync-stockfish-assets] downloading ${dest}`);
    await download(url, destPath);
    const size = fs.statSync(destPath).size;
    console.log(`[sync-stockfish-assets] wrote ${dest} (${size} bytes)`);
  }

  const manifest = {
    officialRepository: 'https://github.com/official-stockfish/Stockfish',
    officialTag: OFFICIAL_STOCKFISH_TAG,
    wasmPortRepository: 'https://github.com/nmrugg/stockfish.js',
    wasmPortRelease: WASM_PORT_RELEASE,
    variant: 'stockfish-18-lite-single',
    syncedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(destDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('[sync-stockfish-assets] wrote manifest.json');
}

main().catch((error) => {
  console.error('[sync-stockfish-assets]', error.message || error);
  process.exit(1);
});
