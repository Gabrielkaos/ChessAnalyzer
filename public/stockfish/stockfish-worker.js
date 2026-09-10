import Sf_19_Web from './sf_19_smallnet.js';

let sf = null;
const commandQueue = [];
let isReady = false;

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

    // Process all queued commands (e.g. 'uci', 'isready')
    while (commandQueue.length > 0) {
      const cmd = commandQueue.shift();
      sf.uci(cmd);
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
