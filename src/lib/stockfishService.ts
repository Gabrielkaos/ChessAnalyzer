import { EngineEvaluation } from '@/types/chess';

export class StockfishService {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private currentResolver: ((evalResult: EngineEvaluation) => void) | null = null;
  private currentEval: Partial<EngineEvaluation> = {};
  private currentFen: string = '';
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Lazy initialized on client
  }

  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.worker && this.isReady) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve) => {
      try {
        const wasmSupported =
          typeof WebAssembly === 'object' &&
          WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));

        const scriptUrl = wasmSupported
          ? '/stockfish/stockfish.wasm.js'
          : '/stockfish/stockfish.js';

        this.worker = new Worker(scriptUrl);

        this.worker.onmessage = (event: MessageEvent) => {
          this.handleMessage(typeof event.data === 'string' ? event.data : String(event.data));
        };

        this.worker.onerror = (err) => {
          console.warn('Stockfish Worker error, falling back to JS worker:', err);
          if (wasmSupported) {
            try {
              this.worker?.terminate();
              this.worker = new Worker('/stockfish/stockfish.js');
              this.worker.onmessage = (e) => this.handleMessage(String(e.data));
              this.worker.postMessage('uci');
            } catch (fallbackErr) {
              console.error('Failed to init fallback stockfish:', fallbackErr);
            }
          }
        };

        // Wait for readyok or uciok
        const readyListener = (event: MessageEvent) => {
          const msg = String(event.data);
          if (msg.includes('uciok') || msg.includes('readyok')) {
            this.isReady = true;
            this.worker?.removeEventListener('message', readyListener);
            resolve();
          }
        };

        this.worker.addEventListener('message', readyListener);
        this.worker.postMessage('uci');
        this.worker.postMessage('isready');

        // Safety timeout
        setTimeout(() => {
          this.isReady = true;
          resolve();
        }, 3000);
      } catch (err) {
        console.error('Stockfish init error:', err);
        resolve();
      }
    });

    return this.initPromise;
  }

  private evalQueue: Promise<unknown> = Promise.resolve();
  private isSearching: boolean = false;

  private currentPositionCmd: string = '';
  private currentDepth: number = 14;

  private handleMessage(line: string) {
    line = line.trim();
    if (!line) return;

    // Phase 1: Wait for readyok to ensure previous search is completely stopped and drained
    if (!this.isSearching) {
      if (line.includes('readyok')) {
        this.isSearching = true;
        this.currentEval = { score: 0, mate: null, depth: 0, pv: '' };
        this.worker?.postMessage(this.currentPositionCmd || `position fen ${this.currentFen}`);
        this.worker?.postMessage(`go depth ${this.currentDepth}`);
      }
      return;
    }

    // Phase 2: Process output for this position
    if (line.startsWith('info') && line.includes('score')) {
      const parts = line.split(/\s+/);
      const scoreIdx = parts.indexOf('score');
      if (scoreIdx !== -1 && scoreIdx + 2 < parts.length) {
        const type = parts[scoreIdx + 1];
        const val = parseInt(parts[scoreIdx + 2], 10);
        const turn = (this.currentFen.split(' ')[1] || 'w').toLowerCase();
        const multiplier = turn === 'w' ? 1 : -1;

        if (type === 'cp') {
          const rawCp = isNaN(val) ? 0 : val;
          this.currentEval.score = rawCp * multiplier;
          this.currentEval.mate = null;
        } else if (type === 'mate') {
          const rawMate = isNaN(val) ? 0 : val;
          const normalizedMate = rawMate * multiplier;
          this.currentEval.mate = normalizedMate;
          if (normalizedMate !== 0) {
            this.currentEval.score =
              normalizedMate > 0
                ? 10000 - normalizedMate * 100
                : -10000 - normalizedMate * 100;
          } else {
            this.currentEval.score = turn === 'w' ? -10000 : 10000;
          }
        }
      }

      const depthIdx = parts.indexOf('depth');
      if (depthIdx !== -1 && depthIdx + 1 < parts.length) {
        this.currentEval.depth = parseInt(parts[depthIdx + 1], 10) || 1;
      }

      const pvIdx = parts.indexOf('pv');
      if (pvIdx !== -1) {
        this.currentEval.pv = parts.slice(pvIdx + 1, pvIdx + 6).join(' ');
      }
    } else if (line.startsWith('bestmove')) {
      const parts = line.split(/\s+/);
      const bestMove = parts[1] || '';
      const result: EngineEvaluation = {
        score: this.currentEval.score ?? 0,
        mate: this.currentEval.mate ?? null,
        bestMove: bestMove === '(none)' ? '' : bestMove,
        depth: this.currentEval.depth ?? this.currentDepth,
        pv: this.currentEval.pv ?? '',
      };

      if (this.currentResolver) {
        const resolve = this.currentResolver;
        this.currentResolver = null;
        this.isSearching = false;
        resolve(result);
      }
    }
  }

  public async evaluatePosition(
    fen: string,
    depth: number = 14,
    options?: { moves?: string[]; initialFen?: string }
  ): Promise<EngineEvaluation> {
    await this.init();

    if (!this.worker) {
      return {
        score: 0,
        mate: null,
        bestMove: '',
        depth: 0,
      };
    }

    let positionCmd = `position fen ${fen}`;
    if (options?.moves && Array.isArray(options.moves)) {
      const isStartpos =
        !options.initialFen ||
        options.initialFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
      if (options.moves.length === 0) {
        positionCmd = isStartpos ? 'position startpos' : `position fen ${options.initialFen}`;
      } else {
        positionCmd = isStartpos
          ? `position startpos moves ${options.moves.join(' ')}`
          : `position fen ${options.initialFen} moves ${options.moves.join(' ')}`;
      }
    }

    const job = this.evalQueue.then(() => {
      return new Promise<EngineEvaluation>((resolve) => {
        this.currentResolver = resolve;
        this.currentFen = fen;
        this.currentPositionCmd = positionCmd;
        this.currentDepth = depth;
        this.isSearching = false;

        this.worker?.postMessage('stop');
        this.worker?.postMessage('isready');

        // Safety timeout: 12 seconds per move max
        setTimeout(() => {
          if (this.currentResolver === resolve) {
            this.worker?.postMessage('stop');
            this.currentResolver = null;
            this.isSearching = false;
            resolve({
              score: this.currentEval.score ?? 0,
              mate: this.currentEval.mate ?? null,
              bestMove: this.currentEval.bestMove ?? '',
              depth: this.currentEval.depth ?? depth,
              pv: this.currentEval.pv ?? '',
            });
          }
        }, 12000);
      });
    });

    this.evalQueue = job.catch(() => {});
    return await job;
  }

  public newGame() {
    try {
      this.worker?.postMessage('stop');
      this.worker?.postMessage('ucinewgame');
      this.worker?.postMessage('isready');
    } catch {}
  }

  public stop() {
    try {
      this.worker?.postMessage('stop');
      if (this.currentResolver) {
        const resolve = this.currentResolver;
        this.currentResolver = null;
        resolve({
          score: this.currentEval.score ?? 0,
          mate: this.currentEval.mate ?? null,
          bestMove: this.currentEval.bestMove ?? '',
          depth: this.currentEval.depth ?? 0,
        });
      }
    } catch {}
  }

  public destroy() {
    try {
      this.worker?.postMessage('quit');
      this.worker?.terminate();
      this.worker = null;
      this.isReady = false;
      this.initPromise = null;
    } catch {}
  }
}

export const stockfishService = new StockfishService();
