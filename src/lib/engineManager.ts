import { EngineEvaluation } from '@/types/chess';
import { stockfishService } from './stockfishService';

export type EngineType = 'native' | 'builtin' | 'custom-file';

export interface DiscoveredNativeEngine {
  id: string;
  name: string;
  author: string;
  path: string;
  isDefault: boolean;
}

export interface EngineConfig {
  type: EngineType;
  nativePath: string;
  nativeName: string;
  customFileName: string;
  depth: number;
}

class EngineManager {
  private config: EngineConfig = {
    type: 'native',
    nativePath: 'ChessAnalyzer/engines/GOOB-2.2-BETA-native',
    nativeName: 'GOOB 2.2-BETA',
    customFileName: '',
    depth: 20,
  };

  private customWorker: Worker | null = null;
  private customResolver: ((result: EngineEvaluation) => void) | null = null;
  private customEval: Partial<EngineEvaluation> = {};

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chess_engine_config');
      if (saved) {
        try {
          this.config = { ...this.config, ...JSON.parse(saved) };
        } catch {}
      }
      this.detectNativeEngines();
    }
  }

  public selectGoob(depth?: number) {
    this.setConfig({
      type: 'native',
      nativeName: 'GOOB 2.2-BETA',
      nativePath: this.config.nativePath || 'ChessAnalyzer/engines/GOOB-2.2-BETA-native',
      depth: depth ?? this.config.depth ?? 20,
    });
  }

  public selectStockfish(depth?: number) {
    this.setConfig({
      type: 'builtin',
      nativeName: 'Stockfish 10',
      depth: depth ?? this.config.depth ?? 20,
    });
  }

  public getActiveEngineName(): string {
    if (this.config.type === 'native') {
      return this.config.nativeName || 'GOOB 2.2-BETA';
    }
    if (this.config.type === 'custom-file') {
      return this.config.customFileName || 'Custom Engine';
    }
    return 'Stockfish 10';
  }

  public getConfig(): EngineConfig {
    return { ...this.config };
  }

  public setConfig(update: Partial<EngineConfig>) {
    this.config = { ...this.config, ...update };
    if (typeof window !== 'undefined') {
      localStorage.setItem('chess_engine_config', JSON.stringify(this.config));
    }
  }

  public async detectNativeEngines(): Promise<DiscoveredNativeEngine[]> {
    if (typeof window === 'undefined') return [];
    try {
      const res = await fetch('/api/engine');
      if (!res.ok) return [];
      const data = await res.json();
      if (data.available && data.engines && data.engines.length > 0) {
        const goob = data.engines.find((e: DiscoveredNativeEngine) => e.isDefault || e.name.includes('GOOB')) || data.engines[0];
        if (!this.config.nativePath || this.config.nativeName?.includes('GOOB')) {
          this.config.nativePath = goob.path;
          this.config.nativeName = goob.name;
        }
        return data.engines;
      }
    } catch {}
    return [];
  }

  public async testNativeEngine(enginePath: string): Promise<{
    success: boolean;
    name: string;
    author: string;
    error?: string;
  }> {
    try {
      const res = await fetch('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', path: enginePath }),
      });
      return await res.json();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to test engine';
      return { success: false, name: '', author: '', error: msg };
    }
  }

  public setCustomEngineFile(file: File): Promise<{ success: boolean; name?: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        if (this.customWorker) {
          this.customWorker.terminate();
          this.customWorker = null;
        }

        const objectUrl = URL.createObjectURL(file);
        this.customWorker = new Worker(objectUrl);

        let detectedName = file.name;

        const onMsg = (event: MessageEvent) => {
          const text = String(event.data || '').trim();
          if (text.startsWith('id name')) {
            detectedName = text.replace('id name', '').trim();
          } else if (text.includes('uciok') || text.includes('readyok')) {
            this.customWorker?.removeEventListener('message', onMsg);
            this.setConfig({
              type: 'custom-file',
              customFileName: detectedName || file.name,
            });
            resolve({ success: true, name: detectedName });
          }
        };

        this.customWorker.addEventListener('message', onMsg);
        this.customWorker.postMessage('uci');
        this.customWorker.postMessage('isready');

        setTimeout(() => {
          this.setConfig({
            type: 'custom-file',
            customFileName: detectedName || file.name,
          });
          resolve({ success: true, name: detectedName });
        }, 2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load custom engine file';
        resolve({ success: false, error: msg });
      }
    });
  }

  public async evaluatePosition(
    fen: string,
    depth?: number,
    options?: { moves?: string[]; initialFen?: string }
  ): Promise<EngineEvaluation> {
    const targetDepth = depth || this.config.depth || 14;

    // 1. Native Local UCI Engine via API
    if (this.config.type === 'native' && this.config.nativePath) {
      try {
        const res = await fetch('/api/engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'evaluate',
            path: this.config.nativePath,
            fen,
            depth: targetDepth,
            moves: options?.moves,
            initialFen: options?.initialFen,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          return {
            score: data.score ?? 0,
            mate: data.mate ?? null,
            bestMove: data.bestMove ?? '',
            depth: data.depth ?? targetDepth,
            pv: data.pv ?? '',
          };
        }
      } catch (e) {
        console.warn('Native engine evaluation failed, falling back to built-in Stockfish:', e);
      }
    }

    // 2. Custom Web Worker File
    if (this.config.type === 'custom-file' && this.customWorker) {
      return new Promise((resolve) => {
        const turn = (fen.split(' ')[1] || 'w').toLowerCase();
        const multiplier = turn === 'w' ? 1 : -1;
        this.customResolver = resolve;
        this.customEval = { score: 0, mate: null, depth: 0, pv: '' };

        const onMsg = (event: MessageEvent) => {
          const line = String(event.data || '').trim();
          if (line.startsWith('info') && line.includes('score')) {
            const parts = line.split(/\s+/);
            const scoreIdx = parts.indexOf('score');
            if (scoreIdx !== -1 && scoreIdx + 2 < parts.length) {
              const type = parts[scoreIdx + 1];
              const val = parseInt(parts[scoreIdx + 2], 10);
              if (type === 'cp') {
                const rawCp = isNaN(val) ? 0 : val;
                this.customEval.score = rawCp * multiplier;
                this.customEval.mate = null;
              } else if (type === 'mate') {
                const rawMate = isNaN(val) ? 0 : val;
                const normalizedMate = rawMate * multiplier;
                this.customEval.mate = normalizedMate;
                if (normalizedMate !== 0) {
                  this.customEval.score =
                    normalizedMate > 0
                      ? 10000 - normalizedMate * 100
                      : -10000 - normalizedMate * 100;
                } else {
                  this.customEval.score = turn === 'w' ? -10000 : 10000;
                }
              }
            }
            const pvIdx = parts.indexOf('pv');
            if (pvIdx !== -1) {
              this.customEval.pv = parts.slice(pvIdx + 1, pvIdx + 6).join(' ');
            }
          } else if (line.startsWith('bestmove')) {
            this.customWorker?.removeEventListener('message', onMsg);
            const parts = line.split(/\s+/);
            const bestMove = parts[1] === '(none)' ? '' : parts[1] || '';
            resolve({
              score: this.customEval.score ?? 0,
              mate: this.customEval.mate ?? null,
              bestMove,
              depth: targetDepth,
              pv: this.customEval.pv ?? '',
            });
          }
        };

        this.customWorker?.addEventListener('message', onMsg);
        this.customWorker?.postMessage('stop');
        if (options?.moves) {
          const isStartpos =
            !options.initialFen ||
            options.initialFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
          if (options.moves.length === 0) {
            this.customWorker?.postMessage(
              isStartpos ? 'position startpos' : `position fen ${options.initialFen}`
            );
          } else {
            this.customWorker?.postMessage(
              isStartpos
                ? `position startpos moves ${options.moves.join(' ')}`
                : `position fen ${options.initialFen} moves ${options.moves.join(' ')}`
            );
          }
        } else {
          this.customWorker?.postMessage(`position fen ${fen}`);
        }
        this.customWorker?.postMessage(`go depth ${targetDepth}`);

        setTimeout(() => {
          if (this.customResolver === resolve) {
            this.customWorker?.removeEventListener('message', onMsg);
            resolve({
              score: this.customEval.score ?? 0,
              mate: this.customEval.mate ?? null,
              bestMove: '',
              depth: targetDepth,
              pv: this.customEval.pv ?? '',
            });
          }
        }, 12000);
      });
    }

    // 3. Built-in WebAssembly Stockfish (universal fallback & default)
    return stockfishService.evaluatePosition(fen, targetDepth, options);
  }

  public async newGame() {
    if (this.config.type === 'native' && this.config.nativePath) {
      try {
        await fetch('/api/engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'newgame', path: this.config.nativePath }),
        });
      } catch (e) {
        console.warn('Failed to send newgame to native engine:', e);
      }
    } else if (this.config.type === 'custom-file' && this.customWorker) {
      this.customWorker.postMessage('stop');
      this.customWorker.postMessage('ucinewgame');
      this.customWorker.postMessage('isready');
    } else {
      stockfishService.newGame();
    }
  }

  public stop() {
    if (this.config.type === 'native') {
      fetch('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      }).catch(() => {});
    } else if (this.config.type === 'custom-file') {
      this.customWorker?.postMessage('stop');
    } else {
      stockfishService.stop();
    }
  }
}

export const engineManager = new EngineManager();
