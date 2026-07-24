# Stockfish (official)

This app uses **[Stockfish](https://github.com/official-stockfish/Stockfish)** — the official open-source chess engine — running as an isolated WASM process inside a hidden WebView.

## Source layout

| Path | Purpose |
|------|---------|
| `vendor/Stockfish/` | Git submodule pinned to official release tag `sf_18` |
| `assets/stockfish/` | Offline WASM + worker bundle (synced by `npm run stockfish:sync`) |
| `lib/stockfishBridgeHtml.ts` | UCI bridge HTML injected into the WebView |
| `components/StockfishWebViewEngine.tsx` | RN ↔ WebView postMessage transport |

## Updating the engine

```bash
# Update official source submodule
cd vendor/Stockfish
git fetch origin tag sf_18
git checkout sf_18
cd ../..

# Re-download matching WASM build (see scripts/sync-stockfish-assets.js)
npm run stockfish:sync
```

The WASM files are built from official Stockfish source via [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js) releases. When bumping Stockfish versions, update both the submodule tag and the release URL in `scripts/sync-stockfish-assets.js`.

## License

Stockfish is **GPL-3.0**. The engine runs in a separate WebView process and communicates via UCI text only. See `LICENSES.md` for full attribution.
