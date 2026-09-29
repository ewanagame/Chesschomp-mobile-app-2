import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import {
  buildStockfishWebViewSource,
  loadWasmBase64,
  prepareStockfishEngineDir,
} from '../lib/stockfishAssets';
import {
  type EngineLifecycleState,
  isEngineUsable,
  lifecycleAfterDestroy,
  lifecycleAfterGoCommand,
  lifecycleAfterPause,
  lifecycleAfterPauseComplete,
  lifecycleAfterReadyOk,
  lifecycleAfterSearchComplete,
  lifecycleOnMount,
  stockfishEngineInstanceGuard,
} from '../lib/stockfishEngineLifecycle';
import { isAnalysisCompleteLine } from '../lib/uciParse';

type BridgeMessage =
  | { type: 'loaded' }
  | { type: 'ready' }
  | { type: 'destroyed' }
  | { type: 'line'; line: string }
  | { type: 'debug'; message: string; data?: unknown }
  | { type: 'error'; message: string; data?: unknown };

type WebViewSource = {
  uri: string;
  baseUrl: string;
  bridgeHtmlLength: number;
};

export type { EngineLifecycleState };

type StockfishEngineContextValue = {
  lifecycleState: EngineLifecycleState;
  isReady: boolean;
  isBridgeConnected: boolean;
  isLoading: boolean;
  error: string | null;
  sendCommand: (command: string) => void;
  addLineListener: (listener: (line: string) => void) => () => void;
  registerAnalysisCancel: (cancel: () => void) => () => void;
  cancelActiveAnalysis: () => void;
  pauseEngine: () => void;
};

const StockfishEngineContext = createContext<StockfishEngineContextValue | null>(null);

function logStockfish(...args: unknown[]) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(...args);
  }
}

export function StockfishEngineProvider({ children }: { children: ReactNode }) {
  const ownerIdRef = useRef(Symbol('stockfish-engine-provider'));
  const canBootRef = useRef(false);

  const webViewRef = useRef<WebView>(null);
  const listenersRef = useRef(new Set<(line: string) => void>());
  const cancelCallbacksRef = useRef(new Set<() => void>());
  const bridgeReadyRef = useRef(false);
  const engineReadyRef = useRef(false);
  const awaitingReadyOkRef = useRef(false);
  const wasmBase64Ref = useRef<string | null>(null);
  const lifecycleStateRef = useRef<EngineLifecycleState>('IDLE');
  const destroyedRef = useRef(false);

  const [webViewSource, setWebViewSource] = useState<WebViewSource | null>(null);
  const [lifecycleState, setLifecycleState] = useState<EngineLifecycleState>('IDLE');
  const [bridgeConnected, setBridgeConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLifecycle = useCallback(
    (
      next:
        | EngineLifecycleState
        | ((current: EngineLifecycleState) => EngineLifecycleState),
    ) => {
      const resolved = typeof next === 'function' ? next(lifecycleStateRef.current) : next;
      lifecycleStateRef.current = resolved;
      setLifecycleState(resolved);
    },
    [],
  );

  const cancelActiveAnalysis = useCallback(() => {
    cancelCallbacksRef.current.forEach((cancel) => {
      try {
        cancel();
      } catch (cancelError) {
        logStockfish('[Stockfish WebView] analysis cancel callback failed', cancelError);
      }
    });
    cancelCallbacksRef.current.clear();
  }, []);

  const registerAnalysisCancel = useCallback((cancel: () => void) => {
    cancelCallbacksRef.current.add(cancel);
    return () => {
      cancelCallbacksRef.current.delete(cancel);
    };
  }, []);

  const postBridgeMessage = useCallback((payload: Record<string, string>) => {
    if (destroyedRef.current) {
      return;
    }
    const serialized = JSON.stringify(payload);
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const preview =
        payload.wasmBase64 != null
          ? serialized.slice(0, 120) + '…[' + payload.wasmBase64.length + ' chars]'
          : serialized;
      logStockfish('[Stockfish WebView] RN -> WebView postMessage', preview);
    }
    webViewRef.current?.postMessage(serialized);
  }, []);

  const sendBridgeCommand = useCallback(
    (command: string) => {
      if (!bridgeReadyRef.current || destroyedRef.current) {
        throw new Error('Stockfish WebView bridge is not loaded yet.');
      }
      postBridgeMessage({ type: 'command', command });
    },
    [postBridgeMessage],
  );

  const pauseEngine = useCallback(() => {
    if (destroyedRef.current) {
      return;
    }

    setLifecycle((current) => lifecycleAfterPause(current));
    cancelActiveAnalysis();

    try {
      sendBridgeCommand('stop');
    } catch {
      // Bridge may not be ready during teardown.
    }

    setLifecycle((current) => lifecycleAfterPauseComplete(current));
  }, [cancelActiveAnalysis, sendBridgeCommand, setLifecycle]);

  const destroyEngineRef = useRef<() => void>(() => {});

  const destroyEngine = useCallback(() => {
    if (destroyedRef.current) {
      return;
    }

    destroyedRef.current = true;
    setLifecycle('STOPPING');
    cancelActiveAnalysis();

    try {
      sendBridgeCommand('stop');
    } catch {
      // Bridge may already be gone.
    }

    if (bridgeReadyRef.current) {
      postBridgeMessage({ type: 'destroy' });
    }

    listenersRef.current.clear();
    bridgeReadyRef.current = false;
    setBridgeConnected(false);
    engineReadyRef.current = false;
    awaitingReadyOkRef.current = false;
    wasmBase64Ref.current = null;
    setWebViewSource(null);
    setLifecycle(lifecycleAfterDestroy());
    stockfishEngineInstanceGuard.release(ownerIdRef.current);
    canBootRef.current = false;
  }, [cancelActiveAnalysis, postBridgeMessage, setLifecycle]);

  destroyEngineRef.current = destroyEngine;

  const bootEngine = useCallback(() => {
    if (!canBootRef.current || destroyedRef.current) {
      return;
    }
    if (engineReadyRef.current || awaitingReadyOkRef.current) {
      logStockfish('[Stockfish WebView] boot skipped, engine already booting or ready');
      return;
    }
    const wasmBase64 = wasmBase64Ref.current;
    if (!wasmBase64) {
      logStockfish('[Stockfish WebView] boot deferred — wasmBase64 not loaded yet');
      return;
    }
    logStockfish('[Stockfish WebView] sending boot command with wasmBinary', wasmBase64.length);
    postBridgeMessage({ type: 'boot', wasmBase64 });
  }, [postBridgeMessage]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (destroyedRef.current) {
        return;
      }

      const raw = event.nativeEvent.data;
      logStockfish('[Stockfish WebView] WebView -> RN onMessage raw', raw);

      let message: BridgeMessage;
      try {
        message = JSON.parse(raw) as BridgeMessage;
      } catch (parseError) {
        console.warn('[Stockfish WebView] failed to parse message', parseError);
        return;
      }

      if (message.type === 'loaded') {
        bridgeReadyRef.current = true;
        setBridgeConnected(true);
        logStockfish('[Stockfish WebView] bridge HTML script running');
        bootEngine();
        return;
      }

      if (message.type === 'debug') {
        logStockfish('[Stockfish WebView debug]', message.message, message.data ?? '');
        return;
      }

      if (message.type === 'ready') {
        if (engineReadyRef.current) {
          return;
        }
        awaitingReadyOkRef.current = true;
        logStockfish('[Stockfish WebView] uciok received, sending isready');
        try {
          sendBridgeCommand('isready');
        } catch (readyError) {
          const readyMessage =
            readyError instanceof Error ? readyError.message : String(readyError);
          setError(readyMessage);
        }
        return;
      }

      if (message.type === 'destroyed') {
        logStockfish('[Stockfish WebView] bridge destroyed');
        return;
      }

      if (message.type === 'error') {
        setError(message.message);
        logStockfish('[Stockfish WebView] error', message.message, message.data ?? '');
        return;
      }

      if (message.type === 'line') {
        const line = message.line;
        logStockfish('[Stockfish UCI]', line);

        if (line === 'readyok' && awaitingReadyOkRef.current) {
          awaitingReadyOkRef.current = false;
          engineReadyRef.current = true;
          setLifecycle(lifecycleAfterReadyOk());
          setError(null);
          logStockfish('[Stockfish WebView] engine ready (readyok)');
        }

        if (isAnalysisCompleteLine(line)) {
          setLifecycle((current) => lifecycleAfterSearchComplete(current));
        }

        listenersRef.current.forEach((listener) => listener(line));
      }
    },
    [bootEngine, sendBridgeCommand, setLifecycle],
  );

  const sendCommand = useCallback(
    (command: string) => {
      logStockfish('[Stockfish WebView] sendCommand', command, 'engineReady=', engineReadyRef.current);
      if (/^go\b/.test(command.trim())) {
        setLifecycle((current) => lifecycleAfterGoCommand(current));
      }
      if (command.trim() === 'stop') {
        setLifecycle((current) => lifecycleAfterPause(current));
      }
      sendBridgeCommand(command);
    },
    [sendBridgeCommand, setLifecycle],
  );

  const addLineListener = useCallback((listener: (line: string) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    let acquired = stockfishEngineInstanceGuard.tryAcquire(ownerId);
    if (!acquired) {
      // Recover from a stale singleton lock (e.g. fast navigation before prior cleanup).
      stockfishEngineInstanceGuard.forceRelease();
      acquired = stockfishEngineInstanceGuard.tryAcquire(ownerId);
    }
    if (!acquired) {
      console.error('[Stockfish WebView] duplicate StockfishEngineProvider mount blocked');
      return;
    }

    destroyedRef.current = false;
    canBootRef.current = true;
    setLifecycle(lifecycleOnMount());

    let cancelled = false;

    prepareStockfishEngineDir()
      .then(async (engineDir) => {
        const [source, wasmBase64] = await Promise.all([
          buildStockfishWebViewSource(engineDir),
          loadWasmBase64(engineDir),
        ]);
        if (!cancelled && !destroyedRef.current) {
          wasmBase64Ref.current = wasmBase64;
          logStockfish('[Stockfish WebView] prepared source', {
            uri: source.uri,
            baseUrl: source.baseUrl,
            bridgeHtmlLength: source.bridgeHtmlLength,
          });
          setWebViewSource(source);
        }
      })
      .catch((err) => {
        logStockfish('[Stockfish WebView] engine dir prepare failed', err);
        if (!cancelled && !destroyedRef.current) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[Stockfish WebView] asset prepare failed', message);
          setError(message);
        }
      });

    return () => {
      cancelled = true;
      destroyEngineRef.current();
      stockfishEngineInstanceGuard.release(ownerId);
    };
    // Mount once per BoardScreen visit; teardown releases WebView + WASM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        pauseEngine();
      }
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [pauseEngine]);

  const isReady = isEngineUsable(lifecycleState);
  const isLoading = lifecycleState === 'LOADING';

  const value = useMemo(
    () => ({
      lifecycleState,
      isReady,
      isBridgeConnected: bridgeConnected && lifecycleState !== 'DESTROYED',
      isLoading,
      error,
      sendCommand,
      addLineListener,
      registerAnalysisCancel,
      cancelActiveAnalysis,
      pauseEngine,
    }),
    [
      addLineListener,
      bridgeConnected,
      cancelActiveAnalysis,
      error,
      isLoading,
      isReady,
      lifecycleState,
      pauseEngine,
      registerAnalysisCancel,
      sendCommand,
    ],
  );

  return (
    <StockfishEngineContext.Provider value={value}>
      {children}
      {webViewSource ? (
        <View pointerEvents="none" style={styles.hiddenHost}>
          <WebView
            ref={webViewRef}
            source={{ uri: webViewSource.uri }}
            onMessage={handleMessage}
            onLoadEnd={() => {
              logStockfish('[Stockfish WebView] onLoadEnd', webViewSource.baseUrl);
              bootEngine();
            }}
            onError={(event) => {
              const message =
                event.nativeEvent.description || 'WebView failed to load Stockfish shell.';
              console.error('[Stockfish WebView] onError', message);
              setError(message);
            }}
            originWhitelist={['*']}
            allowingReadAccessToURL={webViewSource.baseUrl}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            sharedCookiesEnabled={false}
            webviewDebuggingEnabled={typeof __DEV__ !== 'undefined' && __DEV__}
            style={styles.hiddenWebView}
          />
        </View>
      ) : null}
    </StockfishEngineContext.Provider>
  );
}

export function useStockfishEngine(): StockfishEngineContextValue {
  const context = useContext(StockfishEngineContext);
  if (!context) {
    throw new Error('useStockfishEngine must be used within StockfishEngineProvider.');
  }
  return context;
}

export { ANALYSIS_CANCELLED } from '../lib/stockfishCancel';
export type { RegisterAnalysisCancel } from '../lib/stockfishCancel';

const styles = StyleSheet.create({
  hiddenHost: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
});
