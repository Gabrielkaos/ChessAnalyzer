// GOOB WebAssembly Web Worker
// Provides a standard UCI interface over Web Worker postMessage/onmessage

let isReady = false;
let engineInstance = null;
const commandQueue = [];

function processCommand(cmd) {
  if (!engineInstance || !isReady) {
    commandQueue.push(cmd);
    return;
  }
  try {
    engineInstance.ccall('command', null, ['string'], [cmd]);
  } catch (err) {
    console.error('[GOOB WASM] Error executing command:', cmd, err);
  }
}

try {
  importScripts('/goob/goob_engine.js');

  GoobEngine({
    locateFile: function(path, scriptDirectory) {
      if (path.endsWith('.wasm')) {
        return '/goob/' + path;
      }
      return (scriptDirectory || '/goob/') + path;
    },
    print: function(line) {
      postMessage(line);
    },
    printErr: function(err) {
      // Engine stderr or warnings
    }
  }).then(function(instance) {
    engineInstance = instance;
    isReady = true;

    // Drain any commands sent before WASM was fully instantiated
    while (commandQueue.length > 0) {
      const nextCmd = commandQueue.shift();
      engineInstance.ccall('command', null, ['string'], [nextCmd]);
    }
  }).catch(function(err) {
    console.error('[GOOB WASM] Failed to initialize GoobEngine:', err);
  });
} catch (e) {
  console.error('[GOOB WASM] Worker initialization error:', e);
}

onmessage = function(e) {
  const cmd = typeof e.data === 'string' ? e.data : String(e.data);
  processCommand(cmd);
};
