import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

import { buildStockfishBridgeHtml } from './stockfishBridgeHtml';

const ENGINE_SUBDIR = 'stockfish';
const BRIDGE_HTML = 'bridge.html';
const WORKER_JS = 'stockfish-18-lite-single.js';
const WORKER_WASM = 'stockfish-18-lite-single.wasm';

let preparedDir: string | null = null;

export async function prepareStockfishEngineDir(): Promise<string> {
  // #region agent log
  fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-binary',hypothesisId:'H1',location:'stockfishAssets.ts:prepare:entry',message:'prepareStockfishEngineDir called',data:{preparedDir},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-binary',hypothesisId:'H1',location:'stockfishAssets.ts:prepare:success',message:'Stockfish assets ready',data:{engineDir,wasmSize,jsSize},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return engineDir;
}

export async function loadWasmBase64(engineDir: string): Promise<string> {
  const wasmBase64 = await FileSystem.readAsStringAsync(`${engineDir}${WORKER_WASM}`, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // #region agent log
  fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-binary',hypothesisId:'H1',location:'stockfishAssets.ts:loadWasmBase64',message:'wasm base64 loaded for postMessage',data:{wasmBase64Length:wasmBase64.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-binary',hypothesisId:'H4',location:'stockfishAssets.ts:buildSource',message:'bridge html written to cache',data:{bridgePath,bridgeHtmlLength:bridgeHtml.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return { uri: bridgePath, baseUrl: engineDir, bridgeHtmlLength: bridgeHtml.length };
}
