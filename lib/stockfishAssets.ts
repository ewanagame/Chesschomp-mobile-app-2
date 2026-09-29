import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

import { buildStockfishBridgeHtml } from './stockfishBridgeHtml';

const ENGINE_SUBDIR = 'stockfish';
const BRIDGE_HTML = 'bridge.html';
const WORKER_JS = 'stockfish-18-lite-single.js';
const WORKER_WASM = 'stockfish-18-lite-single.wasm';

let preparedDir: string | null = null;

export async function prepareStockfishEngineDir(): Promise<string> {

  if (!FileSystem.cacheDirectory) {
    throw new Error('FileSystem cache directory is unavailable.');
  }

  const engineDir = `${FileSystem.cacheDirectory}${ENGINE_SUBDIR}/`;
  await FileSystem.makeDirectoryAsync(engineDir, { intermediates: true });

  const wasmAsset = Asset.fromModule(require('../assets/stockfish/stockfish-18-lite-single.wasm'));
  const workerAsset = Asset.fromModule(require('../assets/stockfish/stockfish.worker.bin'));

  await Promise.all([wasmAsset.downloadAsync(), workerAsset.downloadAsync()]);

  if (!wasmAsset.localUri || !workerAsset.localUri) {
    throw new Error('Failed to resolve bundled Stockfish assets.');
  }

  await FileSystem.copyAsync({ from: wasmAsset.localUri, to: `${engineDir}${WORKER_WASM}` });

  const workerJs = await FileSystem.readAsStringAsync(workerAsset.localUri);
  await FileSystem.writeAsStringAsync(`${engineDir}${WORKER_JS}`, workerJs);

  const wasmInfo = await FileSystem.getInfoAsync(`${engineDir}${WORKER_WASM}`);
  const jsInfo = await FileSystem.getInfoAsync(`${engineDir}${WORKER_JS}`);

  const wasmSize = wasmInfo.exists ? wasmInfo.size : 0;
  const jsSize = jsInfo.exists ? jsInfo.size : 0;

  console.log('[Stockfish assets] engineDir:', engineDir);
  console.log('[Stockfish assets] wasm exists:', wasmInfo.exists, 'size:', wasmSize);
  console.log('[Stockfish assets] js exists:', jsInfo.exists, 'size:', jsSize);

  if (!wasmInfo.exists || !jsInfo.exists) {
    throw new Error('Stockfish engine files missing after copy to cache.');
  }

  preparedDir = engineDir;

  return engineDir;
}

export async function loadWasmBase64(engineDir: string): Promise<string> {
  const wasmBase64 = await FileSystem.readAsStringAsync(`${engineDir}${WORKER_WASM}`, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return wasmBase64;
}

export async function buildStockfishWebViewSource(
  engineDir: string,
): Promise<{ uri: string; baseUrl: string; bridgeHtmlLength: number }> {
  const bridgeHtml = buildStockfishBridgeHtml();
  const bridgePath = `${engineDir}${BRIDGE_HTML}`;
  await FileSystem.writeAsStringAsync(bridgePath, bridgeHtml);

  console.log('[Stockfish assets] wrote bridge HTML', {
    bridgePath,
    bridgeHtmlLength: bridgeHtml.length,
  });

  return { uri: bridgePath, baseUrl: engineDir, bridgeHtmlLength: bridgeHtml.length };
}
