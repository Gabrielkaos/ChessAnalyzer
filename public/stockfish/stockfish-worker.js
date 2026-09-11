import Sf_19_Web from './sf_19_smallnet.js';

let sf = null;
const commandQueue = [];
let isReady = false;

// Multi-threaded search is only possible when SharedArrayBuffer is available
// (the app is served with COOP/COEP headers, so crossOriginIsolated is true).
const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 1;
const canUseThreads = typeof self !== 'undefined' && self.crossOriginIsolated === true;
const THREADS = canUseThreads ? Math.min(Math.max(cores, 1), 4) : 1;
const HASH_MB = 64;

async function init() {
  try {
    const nnueRes = await fetch('/stockfish/nn-61e7af4bb97d.nnue');
    if (!nnueRes.ok) {
      throw new Error(`Failed to load NNUE net (${nnueRes.status} ${nnueRes.statusText})`);
    }
    const nnueBuf = new Uint8Array(await nnueRes.arrayBuffer());

    sf = await Sf_19_Web({
      locateFile: (file) => `/stockfish/${file}`,
      mainScriptUrlOrBlob: '/stockfish/sf_19_smallnet.js',
    });

    sf.listen = (line) => {
      self.postMessage(line);
    };

    sf.onError = (err) => {
      console.warn('Stockfish 19 WASM warning:', err);
    };

    // Load NNUE weights buffer into Stockfish 19
    sf.setNnueBuffer(nnueBuf, 0);

    isReady = true;

    // Process queued commands, injecting UCI engine options after 'uci'
    // but keeping 'isready' at the end so options are applied before readiness.
    const flush = commandQueue.splice(0);
    const deferredIsReady = [];
    let sentUci = false;
    for (const cmd of flush) {
      const c = String(cmd).trim();
      if (c === 'uci') {
        sentUci = true;
        sf.uci(c);
        sf.uci(`setoption name Threads value ${THREADS}`);
        sf.uci(`setoption name Hash value ${HASH_MB}`);
      } else if (c === 'isready') {
        deferredIsReady.push(c);
      } else {
        sf.uci(c);
      }
    }
    if (sentUci && deferredIsReady.length) {
      for (const c of deferredIsReady) sf.uci(c);
    } else if (!sentUci) {
      for (const c of flush) sf.uci(c);
    }
  } catch (err) {
    console.error('Stockfish 19 initialization error:', err);
    self.postMessage('error Stockfish 19 initialization error: ' + (err?.message || String(err)));
  }
}

self.onmessage = (event) => {
  const data = typeof event.data === 'string' ? event.data : event.data?.cmd;
  if (!data) return;

  if (isReady && sf) {
    sf.uci(data);
  } else {
    commandQueue.push(data);
  }
};

init();
