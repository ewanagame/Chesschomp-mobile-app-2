const WORKER_JS = 'stockfish-18-lite-single.js';

/**
 * Bridge HTML — main-thread Stockfish only.
 * WASM bytes are passed from RN via postMessage boot payload (file:// fetch fails in WKWebView).
 */
export function buildStockfishBridgeHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stockfish UCI Bridge</title>
  </head>
  <body>
    <script>
      (function () {
        var WORKER_JS = ${JSON.stringify(WORKER_JS)};
        var UCI_TIMEOUT_MS = 15000;

        var mainEngine = null;
        var booted = false;
        var uciReady = false;
        var pendingCommands = [];
        var uciTimeoutId = null;

        function post(payload) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        }

        function log(message, data) {
          console.log('[Stockfish bridge]', message, data || '');
          post({ type: 'debug', message: message, data: data || null });
        }

        function engineBaseUrl() {
          return location.href.replace(/[^/]+$/, '');
        }

        function clearUciTimeout() {
          if (uciTimeoutId) {
            clearTimeout(uciTimeoutId);
            uciTimeoutId = null;
          }
        }

        function scheduleUciTimeout(label) {
          clearUciTimeout();
          uciTimeoutId = setTimeout(function () {
            if (uciReady) {
              return;
            }
            log('uciok timeout', { label: label });
            post({
              type: 'error',
              message: 'Stockfish uciok timeout after ' + label,
            });
          }, UCI_TIMEOUT_MS);
        }

        function base64ToUint8Array(base64) {
          var binary = atob(base64);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        }

        function probeWebAssembly() {
          var info = {
            supported: typeof WebAssembly !== 'undefined',
            instantiate: typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function',
            instantiateStreaming:
              typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiateStreaming === 'function',
          };
          log('WebAssembly capability probe', info);
          return info;
        }

        function verifyWasmBytes(wasmBytes) {
          var magicOk =
            wasmBytes.length >= 4 &&
            wasmBytes[0] === 0x00 &&
            wasmBytes[1] === 0x61 &&
            wasmBytes[2] === 0x73 &&
            wasmBytes[3] === 0x6d;
          log('wasm binary verification', {
            byteLength: wasmBytes.length,
            magicOk: magicOk,
            header: [
              wasmBytes[0],
              wasmBytes[1],
              wasmBytes[2],
              wasmBytes[3],
              wasmBytes[4],
              wasmBytes[5],
              wasmBytes[6],
              wasmBytes[7],
            ],
          });
          if (!magicOk) {
            post({ type: 'error', message: 'WASM magic header invalid — file may be truncated or corrupted' });
            return false;
          }
          return true;
        }

        function handleEngineLine(line) {
          line.split('\\n').forEach(function (part) {
            var trimmed = part.trim();
            if (!trimmed) {
              return;
            }
            if (trimmed === 'uciok') {
              uciReady = true;
              clearUciTimeout();
              log('uciok received', { engineMode: 'main-wasmBinary' });
              post({ type: 'ready' });
              flushPending();
            }
            if (trimmed === 'readyok') {
              log('handshake line', { line: trimmed });
            }
            post({ type: 'line', line: trimmed });
          });
        }

        function flushPending() {
          if (!uciReady) {
            return;
          }
          while (pendingCommands.length) {
            sendToEngine(pendingCommands.shift());
          }
        }

        function sendToEngine(command) {
          if (!uciReady) {
            pendingCommands.push(command);
            log('queued command before uciok', { command: command, queueSize: pendingCommands.length });
            return;
          }
          log('posting command to engine', { command: command });
          if (mainEngine && mainEngine.processCommand) {
            mainEngine.processCommand(command);
            return;
          }
          post({ type: 'error', message: 'Engine processCommand unavailable' });
        }

        /**
         * stockfish.js attaches processCommand in its internal l() bootstrap, which only
         * runs in Worker/Node paths. When calling factory() from the main thread we must
         * replicate that wiring ourselves (see stockfish-18-lite-single.js).
         */
        function attachProcessCommand(engine, callback, attempts) {
          attempts = attempts || 0;
          var isEngineReady = !engine._isReady || engine._isReady();

          if (attempts === 0 || attempts % 50 === 0) {
            log('poll engine _isReady', {
              attempt: attempts,
              isEngineReady: isEngineReady,
              hasCcall: typeof engine.ccall === 'function',
              hasProcessCommand: typeof engine.processCommand === 'function',
            });
          }

          if (!isEngineReady) {
            if (attempts > 500) {
              post({
                type: 'error',
                message: 'Stockfish _isReady never became true after WASM init',
                data: { attempts: attempts },
              });
              return;
            }
            setTimeout(function () {
              attachProcessCommand(engine, callback, attempts + 1);
            }, 10);
            return;
          }

          var commandQueue = [];

          function drainQueue() {
            while (commandQueue.length && (!engine._isSearching || !engine._isSearching())) {
              sendRaw(commandQueue.shift());
            }
          }

          function sendRaw(command) {
            log('ccall command', { command: command });
            engine.ccall('command', null, ['string'], [command], {
              async: typeof IS_ASYNCIFY !== 'undefined' && /^go\\b/.test(command),
            });
          }

          engine.onDoneSearching = function () {
            setTimeout(drainQueue, 1);
          };

          engine.processCommand = function (command) {
            command = command.trim();
            if (command.substring(0, 2) === 'go' || command.substring(0, 9) === 'setoption') {
              commandQueue.push(command);
            } else {
              sendRaw(command);
            }
            drainQueue();
          };

          log('processCommand attached manually', {
            hasProcessCommand: typeof engine.processCommand === 'function',
            hasCcall: typeof engine.ccall === 'function',
          });

          callback(engine);
        }

        function bootMainThreadWithWasmBinary(wasmBase64) {
          probeWebAssembly();

          var wasmBytes = base64ToUint8Array(wasmBase64);
          if (!verifyWasmBytes(wasmBytes)) {
            return;
          }

          var jsUrl = engineBaseUrl() + WORKER_JS;
          log('booting main-thread with RN wasmBinary', {
            wasmBytes: wasmBytes.length,
            jsUrl: jsUrl,
          });

          var script = document.createElement('script');
          script.src = jsUrl;
          script.onerror = function () {
            log('stockfish script onerror', { src: script.src });
            post({ type: 'error', message: 'Stockfish script failed to load', data: { src: script.src } });
          };
          script.onload = function () {
            log('stockfish script onload', { hasExports: typeof script._exports === 'function' });
            var factory = script._exports;
            if (typeof factory !== 'function') {
              post({ type: 'error', message: 'Stockfish factory missing on script._exports' });
              return;
            }
            try {
              log('calling stockfish factory with wasmBinary');
              factory({
                wasmBinary: wasmBytes,
                listener: function (line) {
                  handleEngineLine(String(line));
                },
                printErr: function (text) {
                  log('emscripten printErr', { text: String(text) });
                },
                onAbort: function (reason) {
                  log('emscripten onAbort', { reason: String(reason) });
                },
              })
                .then(function (engine) {
                  log('factory promise resolved — WASM instantiate succeeded', {
                    hasCcall: typeof engine.ccall === 'function',
                    hasIsReady: typeof engine._isReady === 'function',
                    factoryProcessCommand: typeof engine.processCommand === 'function',
                  });

                  attachProcessCommand(engine, function (readyEngine) {
                    mainEngine = readyEngine;
                    log('sending uci via processCommand');
                    scheduleUciTimeout('after uci send');
                    readyEngine.processCommand('uci');
                  });
                })
                .catch(function (error) {
                  log('factory promise rejected — WASM instantiate failed', {
                    message: error.message || String(error),
                    stack: error.stack || null,
                    name: error.name || null,
                  });
                  post({
                    type: 'error',
                    message: error.message || String(error),
                    data: { stack: error.stack || null, phase: 'factory wasmBinary' },
                  });
                });
            } catch (error) {
              log('factory threw synchronously', {
                message: error.message || String(error),
                stack: error.stack || null,
              });
              post({
                type: 'error',
                message: error.message || String(error),
                data: { stack: error.stack || null, phase: 'factory sync' },
              });
            }
          };
          document.head.appendChild(script);
        }

        function handleCommand(raw) {
          var message;
          try {
            message = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch (error) {
            post({ type: 'error', message: 'Invalid bridge message: ' + error.message });
            return;
          }

          if (message.type === 'boot') {
            if (booted) {
              if (uciReady) {
                post({ type: 'ready' });
              }
              return;
            }
            booted = true;
            if (!message.wasmBase64 || typeof message.wasmBase64 !== 'string') {
              post({ type: 'error', message: 'boot missing wasmBase64 from RN' });
              return;
            }
            log('boot requested with wasmBase64', { length: message.wasmBase64.length });
            bootMainThreadWithWasmBinary(message.wasmBase64);
            return;
          }

          if (message.type === 'command' && typeof message.command === 'string') {
            log('command received from RN', { command: message.command });
            try {
              sendToEngine(message.command);
            } catch (error) {
              post({ type: 'error', message: error.message || String(error) });
            }
            return;
          }

          post({ type: 'error', message: 'Unknown bridge message type' });
        }

        document.addEventListener('message', function (event) {
          handleCommand(event.data);
        });
        window.addEventListener('message', function (event) {
          if (typeof event.data === 'string') {
            handleCommand(event.data);
          }
        });

        post({ type: 'loaded' });
        log('bridge ready — awaiting boot with wasmBase64 from RN', { base: engineBaseUrl() });
      })();
    </script>
  </body>
</html>`;
}
