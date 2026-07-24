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
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import {
  buildStockfishWebViewSource,
  loadWasmBase64,
  prepareStockfishEngineDir,
} from '../lib/stockfishAssets';

type BridgeMessage =
  | { type: 'loaded' }
  | { type: 'ready' }
  | { type: 'line'; line: string }
  | { type: 'debug'; message: string; data?: unknown }
  | { type: 'error'; message: string; data?: unknown };

type WebViewSource = {
  uri: string;
  baseUrl: string;
  bridgeHtmlLength: number;
};

type StockfishEngineContextValue = {
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  sendCommand: (command: string) => void;
  addLineListener: (listener: (line: string) => void) => () => void;
};

const StockfishEngineContext = createContext<StockfishEngineContextValue | null>(null);

export function StockfishEngineProvider({ children }: { children: ReactNode }) {
  const webViewRef = useRef<WebView>(null);
  const listenersRef = useRef(new Set<(line: string) => void>());
  const bridgeReadyRef = useRef(false);
  const engineReadyRef = useRef(false);
  const wasmBase64Ref = useRef<string | null>(null);

  const [webViewSource, setWebViewSource] = useState<WebViewSource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    prepareStockfishEngineDir()
      .then(async (engineDir) => {
        const [source, wasmBase64] = await Promise.all([
          buildStockfishWebViewSource(engineDir),
          loadWasmBase64(engineDir),
        ]);
        if (!cancelled) {
          wasmBase64Ref.current = wasmBase64;
          console.log('[Stockfish WebView] prepared source', {
            uri: source.uri,
            baseUrl: source.baseUrl,
            bridgeHtmlLength: source.bridgeHtmlLength,
          });
          // #region agent log
          fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H2',location:'StockfishWebViewEngine.tsx:sourceReady',message:'WebView source built',data:{uri:source.uri,baseUrl:source.baseUrl,bridgeHtmlLength:source.bridgeHtmlLength},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          setWebViewSource(source);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[Stockfish WebView] asset prepare failed', message);
          // #region agent log
          fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'engine-load',hypothesisId:'H1',location:'StockfishWebViewEngine.tsx:prepare:catch',message:'asset prepare failed',data:{error:message},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          setError(message);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!webViewSource || isReady) {
      return;
    }
    const timeoutId = setTimeout(() => {
      // #region agent log
      fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H3',location:'StockfishWebViewEngine.tsx:watchdog',message:'engine still not ready after 12s',data:{bridgeReady:bridgeReadyRef.current,engineReady:engineReadyRef.current,uri:webViewSource.uri,error},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }, 12_000);
    return () => clearTimeout(timeoutId);
  }, [webViewSource, isReady, error]);

  const postBridgeMessage = useCallback((payload: Record<string, string>) => {
    const serialized = JSON.stringify(payload);
    const preview =
      payload.wasmBase64 != null
        ? serialized.slice(0, 120) + '…[' + payload.wasmBase64.length + ' chars]'
        : serialized;
    console.log('[Stockfish WebView] RN -> WebView postMessage', preview);
    webViewRef.current?.postMessage(serialized);
  }, []);

  const bootEngine = useCallback(() => {
    if (engineReadyRef.current) {
      console.log('[Stockfish WebView] boot skipped, engine already ready');
      return;
    }
    const wasmBase64 = wasmBase64Ref.current;
    if (!wasmBase64) {
      console.warn('[Stockfish WebView] boot deferred — wasmBase64 not loaded yet');
      return;
    }
    console.log('[Stockfish WebView] sending boot command with wasmBinary', wasmBase64.length);
    // #region agent log
    fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-binary',hypothesisId:'H4',location:'StockfishWebViewEngine.tsx:bootEngine',message:'boot with wasmBase64',data:{wasmBase64Length:wasmBase64.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    postBridgeMessage({ type: 'boot', wasmBase64 });
  }, [postBridgeMessage]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      console.log('[Stockfish WebView] WebView -> RN onMessage raw', raw);

      let message: BridgeMessage;
      try {
        message = JSON.parse(raw) as BridgeMessage;
      } catch (parseError) {
        console.warn('[Stockfish WebView] failed to parse message', parseError);
        return;
      }

      if (message.type === 'loaded') {
        bridgeReadyRef.current = true;
        console.log('[Stockfish WebView] bridge HTML script running');
        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-fix',hypothesisId:'H1',location:'StockfishWebViewEngine.tsx:loaded',message:'WebView bridge loaded',data:{baseUrl:webViewSource?.baseUrl},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        bootEngine();
        return;
      }

      if (message.type === 'debug') {
        console.log('[Stockfish WebView debug]', message.message, message.data ?? '');
        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-fix',hypothesisId:'H2',location:'StockfishWebViewEngine.tsx:debug',message:message.message,data:message.data,timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }

      if (message.type === 'ready') {
        engineReadyRef.current = true;
        setIsReady(true);
        setIsLoading(false);
        setError(null);
        console.log('[Stockfish WebView] engine ready (uciok)');
        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-fix',hypothesisId:'H3',location:'StockfishWebViewEngine.tsx:ready',message:'Stockfish uciok received',data:{},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }

      if (message.type === 'error') {
        setError(message.message);
        setIsLoading(false);
        console.error('[Stockfish WebView] error', message.message, message.data ?? '');
        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'post-fix',hypothesisId:'H4',location:'StockfishWebViewEngine.tsx:error',message:message.message,data:message.data,timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }

      if (message.type === 'line') {
        console.log('[Stockfish UCI]', message.line);
        // #region agent log
        fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-fix',hypothesisId:'H4',location:'StockfishWebViewEngine.tsx:line',message:'uci line',data:{line:message.line},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        listenersRef.current.forEach((listener) => listener(message.line));
      }
    },
    [bootEngine, webViewSource?.baseUrl],
  );

  const sendCommand = useCallback(
    (command: string) => {
      if (!bridgeReadyRef.current) {
        throw new Error('Stockfish WebView bridge is not loaded yet.');
      }
      console.log('[Stockfish WebView] sendCommand', command, 'engineReady=', engineReadyRef.current);
      // #region agent log
      fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'wasm-fix',hypothesisId:'H5',location:'StockfishWebViewEngine.tsx:sendCommand',message:'sendCommand called',data:{command,engineReady:engineReadyRef.current},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      postBridgeMessage({ type: 'command', command });
    },
    [postBridgeMessage],
  );

  const addLineListener = useCallback((listener: (line: string) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({
      isReady,
      isLoading,
      error,
      sendCommand,
      addLineListener,
    }),
    [addLineListener, error, isLoading, isReady, sendCommand],
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
            onLoadStart={() => {
              console.log('[Stockfish WebView] onLoadStart', webViewSource.baseUrl);
              // #region agent log
              fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'engine-load',hypothesisId:'H2',location:'StockfishWebViewEngine.tsx:onLoadStart',message:'WebView load started',data:{baseUrl:webViewSource.baseUrl},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
            }}
            onLoadEnd={() => {
              console.log('[Stockfish WebView] onLoadEnd', webViewSource.baseUrl);
              // #region agent log
              fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'engine-load',hypothesisId:'H5',location:'StockfishWebViewEngine.tsx:onLoadEnd',message:'WebView load ended, calling bootEngine',data:{bridgeReady:bridgeReadyRef.current},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
              bootEngine();
            }}
            onError={(event) => {
              const message = event.nativeEvent.description || 'WebView failed to load Stockfish shell.';
              console.error('[Stockfish WebView] onError', message);
              // #region agent log
              fetch('http://127.0.0.1:7379/ingest/7f09bb4c-e915-4530-8fd7-f1396c87e72c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'687eca'},body:JSON.stringify({sessionId:'687eca',runId:'engine-load',hypothesisId:'H2',location:'StockfishWebViewEngine.tsx:onError',message:'WebView load error',data:{description:message},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
              setError(message);
              setIsLoading(false);
            }}
            onHttpError={(event) => {
              console.error('[Stockfish WebView] onHttpError', event.nativeEvent.statusCode, event.nativeEvent.url);
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
            webviewDebuggingEnabled
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

const styles = StyleSheet.create({
  hiddenHost: {
    position: 'absolute',
    top: -1000,
    left: 0,
    width: 320,
    height: 240,
    opacity: 0.01,
    overflow: 'hidden',
  },
  hiddenWebView: {
    width: 320,
    height: 240,
  },
});
