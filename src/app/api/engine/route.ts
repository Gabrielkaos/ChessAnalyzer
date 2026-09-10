import { NextRequest, NextResponse } from 'next/server';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface EngineInfo {
  id: string;
  name: string;
  author: string;
  path: string;
  isDefault: boolean;
  tier: number;
  features: string;
  description: string;
  isCompatible: boolean;
}

let activeProcess: ChildProcess | null = null;
let activeEnginePath: string | null = null;
let evalQueue: Promise<unknown> = Promise.resolve();
const compatibilityCache = new Map<string, boolean>();

function getEngineMetadata(fileName: string): {
  name: string;
  tier: number;
  features: string;
  description: string;
} {
  const lower = fileName.toLowerCase();
  if (lower.includes('v3') || lower.includes('x86-64-v3')) {
    return {
      name: 'GOOB 2.2-BETA (v3 - AVX2/BMI2)',
      tier: 3,
      features: 'AVX2 + BMI2 (PEXT Bitboards)',
      description: 'Fast hardware bitboard attacks. Optimal for modern CPUs (Haswell / Zen 3+).',
    };
  }
  if (lower.includes('native')) {
    return {
      name: 'GOOB 2.2-BETA (Native Host)',
      tier: 4,
      features: 'Host CPU ISA & Cache Tuned',
      description: 'Compiled with -march=native tuned for this host machine microarchitecture.',
    };
  }
  if (lower.includes('v2') || lower.includes('x86-64-v2')) {
    return {
      name: 'GOOB 2.2-BETA (v2 - SSE4.2/POPCNT)',
      tier: 2,
      features: 'SSE4.2 + Hardware POPCNT',
      description: 'Hardware popcount via __SSE4_2__ for tbprobe and bitboards (2008+).',
    };
  }
  if (lower.includes('x86-64') || lower.includes('goob')) {
    return {
      name: 'GOOB 2.2-BETA (x86-64 Baseline)',
      tier: 1,
      features: 'Baseline SSE2 (Universal Compatibility)',
      description: 'Widest compatibility, magic slider fallback. Runs on every 64-bit x86 computer.',
    };
  }
  return {
    name: fileName.replace(/\.exe$/i, ''),
    tier: 1,
    features: process.platform === 'win32' ? 'Windows Executable' : 'Custom UCI',
    description: 'Custom UCI chess engine.',
  };
}

function checkEngineCompatibility(resolvedPath: string): boolean {
  if (compatibilityCache.has(resolvedPath)) {
    return compatibilityCache.get(resolvedPath)!;
  }

  // Windows check
  if (process.platform === 'win32') {
    const isExe = resolvedPath.toLowerCase().endsWith('.exe');
    compatibilityCache.set(resolvedPath, isExe);
    return isExe;
  }

  // Linux/POSIX test run uci handshake to ensure host CPU doesn't trigger SIGILL
  try {
    const res = spawnSync(resolvedPath, [], {
      input: 'uci\nquit\n',
      encoding: 'utf8',
      timeout: 1000,
    });
    const ok = res.status === 0 && Boolean(res.stdout?.includes('uciok'));
    compatibilityCache.set(resolvedPath, ok);
    return ok;
  } catch {
    compatibilityCache.set(resolvedPath, false);
    return false;
  }
}

function scanForEngines(): EngineInfo[] {
  const discovered: EngineInfo[] = [];
  const searchDirs = [
    path.resolve(process.cwd(), 'ChessAnalyzer', 'engines'),
    path.resolve(process.cwd(), 'engines'),
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(dir, entry.name);

        try {
          const fd = fs.openSync(fullPath, 'r');
          const buffer = Buffer.alloc(4);
          fs.readSync(fd, buffer, 0, 4, 0);
          fs.closeSync(fd);

          const isElf = buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46;
          const isWindowsExe = buffer[0] === 0x4d && buffer[1] === 0x5a;
          const isMachO = buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe;

          if (!isElf && !isWindowsExe && !isMachO && !entry.name.includes('GOOB') && !entry.name.includes('native')) {
            continue;
          }

          if (process.platform !== 'win32') {
            try {
              fs.chmodSync(fullPath, 0o755);
            } catch {}
          }

          const meta = getEngineMetadata(entry.name);
          const isCompatible = checkEngineCompatibility(fullPath);

          discovered.push({
            id: entry.name,
            name: meta.name,
            author: entry.name.includes('GOOB') ? 'Gabriel Montes' : 'Local UCI Author',
            path: fullPath,
            isDefault: false,
            tier: meta.tier,
            features: meta.features,
            description: meta.description,
            isCompatible,
          });
        } catch {}
      }
    } catch {}
  }

  // Deduplicate by path
  const unique = new Map<string, EngineInfo>();
  for (const eng of discovered) {
    if (!unique.has(eng.path)) {
      unique.set(eng.path, eng);
    }
  }

  const list = Array.from(unique.values());

  // Sort: compatible first, then highest tier first
  list.sort((a, b) => {
    if (a.isCompatible !== b.isCompatible) return a.isCompatible ? -1 : 1;
    return b.tier - a.tier;
  });

  // Mark the best compatible engine as default
  const defaultEng = list.find((e) => e.isCompatible) || list[0];
  if (defaultEng) {
    defaultEng.isDefault = true;
  }

  return list;
}

function resolveEngineExecutable(enginePath?: string): string {
  const req = enginePath?.trim() || 'default';
  const engines = scanForEngines();
  const compatibleEngines = engines.filter((e) => e.isCompatible);

  // If default or 'goob' requested, pick the highest compatible engine
  if (req === 'goob' || req === 'default') {
    const def = compatibleEngines.find((e) => e.isDefault) || compatibleEngines[0] || engines[0];
    if (def) return def.path;
  }

  let target = path.isAbsolute(req) ? req : path.resolve(process.cwd(), req);
  if (!fs.existsSync(target)) {
    const base = path.basename(req);
    const candidates = [
      path.resolve(process.cwd(), 'ChessAnalyzer', 'engines', base),
      path.resolve(process.cwd(), 'engines', base),
      path.resolve(process.cwd(), 'ChessAnalyzer', 'engines', 'GOOB-2.2-BETA-x86-64-v3'),
      path.resolve(process.cwd(), 'ChessAnalyzer', 'engines', 'GOOB-2.2-BETA-x86-64'),
      path.resolve('/tmp', base),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        target = cand;
        break;
      }
    }
  }

  if (process.platform !== 'win32' && fs.existsSync(target)) {
    try {
      fs.chmodSync(target, 0o755);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'EROFS' || code === 'EACCES') {
        const tmpDest = path.join('/tmp', path.basename(target));
        try {
          if (!fs.existsSync(tmpDest) || fs.statSync(tmpDest).size !== fs.statSync(target).size) {
            fs.copyFileSync(target, tmpDest);
          }
          fs.chmodSync(tmpDest, 0o755);
          target = tmpDest;
        } catch {}
      }
    }
  }

  // Safety: If the target is NOT compatible with this host CPU (e.g. user requested v3 on a non-AVX2 CPU)
  // dynamically fall back to the highest compatible engine to prevent crashing with SIGILL!
  if (fs.existsSync(target) && !checkEngineCompatibility(target) && compatibleEngines.length > 0) {
    const fallback = compatibleEngines.find((e) => e.isDefault) || compatibleEngines[0];
    if (fallback) {
      console.warn(`[Engine] Requested engine ${target} is not compatible with host CPU; falling back to ${fallback.path}`);
      return fallback.path;
    }
  }

  return target;
}

function testEngineHandshake(enginePath: string): Promise<{
  success: boolean;
  name: string;
  author: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const resolved = resolveEngineExecutable(enginePath);
      if (!fs.existsSync(resolved)) {
        return resolve({ success: false, name: '', author: '', error: 'File does not exist: ' + enginePath });
      }

      const proc = spawn(resolved, [], { stdio: ['pipe', 'pipe', 'pipe'] });
      let output = '';
      let name = 'Unknown Engine';
      let author = 'Unknown Author';

      const timeout = setTimeout(() => {
        try {
          proc.kill();
        } catch {}
        resolve({ success: false, name, author, error: 'Engine handshake timed out' });
      }, 3000);

      proc.stdout?.on('data', (data) => {
        output += data.toString();
        const lines = output.split('\n');
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (line.startsWith('id name')) {
            name = line.replace('id name', '').trim();
          } else if (line.startsWith('id author')) {
            author = line.replace('id author', '').trim();
          } else if (line.includes('uciok')) {
            clearTimeout(timeout);
            try {
              proc.stdin?.write('quit\n');
              proc.kill();
            } catch {}
            return resolve({ success: true, name, author });
          }
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, name: '', author: '', error: err.message });
      });

      proc.stdin?.write('uci\n');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      resolve({ success: false, name: '', author: '', error: msg });
    }
  });
}

function getOrSpawnEngine(enginePath: string): ChildProcess {
  const resolved = resolveEngineExecutable(enginePath);
  if (activeProcess && activeEnginePath === resolved && !activeProcess.killed) {
    return activeProcess;
  }

  if (activeProcess) {
    try {
      activeProcess.stdin?.write('quit\n');
      activeProcess.kill();
    } catch {}
    activeProcess = null;
  }

  const proc = spawn(resolved, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  proc.stdout?.setEncoding('utf8');
  proc.stdin?.write('uci\nisready\nucinewgame\n');

  activeProcess = proc;
  activeEnginePath = resolved;

  proc.on('exit', () => {
    if (activeProcess === proc) {
      activeProcess = null;
      activeEnginePath = null;
    }
  });

  return proc;
}

export async function GET() {
  try {
    const engines = scanForEngines();
    const isWindows = process.platform === 'win32';
    const compatibleEngines = engines.filter((e) => e.isCompatible);
    const defaultEng = compatibleEngines.find((e) => e.isDefault) || compatibleEngines[0] || engines[0];

    return NextResponse.json({
      available: compatibleEngines.length > 0,
      platform: process.platform,
      arch: process.arch,
      engines,
      defaultEnginePath: defaultEng?.path || '',
      optimalEngine: defaultEng || null,
      message:
        isWindows && compatibleEngines.length === 0
          ? 'Running on Windows: Native Linux ELF binaries cannot run natively. WebAssembly Stockfish 10 is automatically active for in-browser local compute. You can also place a Windows UCI .exe in ChessAnalyzer/engines/.'
          : undefined,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to scan engines';
    return NextResponse.json({ available: false, engines: [], error: msg });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, path: enginePath, fen, depth = 12, moves, initialFen } = body;

    if (action === 'test') {
      if (!enginePath) {
        return NextResponse.json({ success: false, error: 'Engine path required' }, { status: 400 });
      }
      const testResult = await testEngineHandshake(enginePath);
      return NextResponse.json(testResult);
    }

    if (action === 'stop') {
      if (activeProcess) {
        try {
          activeProcess.stdin?.write('stop\n');
        } catch {}
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'newgame' || action === 'ucinewgame') {
      if (activeProcess) {
        try {
          activeProcess.stdin?.write('stop\nucinewgame\nisready\n');
        } catch {}
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'evaluate') {
      if (!enginePath || !fen) {
        return NextResponse.json(
          { error: 'Missing engine path or fen string' },
          { status: 400 }
        );
      }

      const proc = getOrSpawnEngine(enginePath);

      const job = evalQueue.then(() => {
        return new Promise<NextResponse>((resolve) => {
          const turn = (fen.split(' ')[1] || 'w').toLowerCase();
          const multiplier = turn === 'w' ? 1 : -1;

          let currentScore = 0;
          let currentMate: number | null = null;
          let currentBestMove = '';
          let currentPv = '';
          let currentDepth = 0;

          let isSearching = false;
          let drainBuf = '';

          let lineBuf = '';

          const cleanupAndResolve = (payload: {
            score: number;
            mate: number | null;
            bestMove: string;
            pv: string;
            depth: number;
          }) => {
            clearTimeout(timeout);
            proc.stdout?.off('data', onData);
            proc.off('error', onError);
            resolve(NextResponse.json(payload));
          };

          const onError = () => {
            cleanupAndResolve({
              score: currentScore,
              mate: currentMate,
              bestMove: currentBestMove,
              pv: currentPv,
              depth: currentDepth || depth,
            });
          };

          const timeout = setTimeout(() => {
            try {
              proc.stdin?.write('stop\n');
            } catch {}
            cleanupAndResolve({
              score: currentScore,
              mate: currentMate,
              bestMove: currentBestMove,
              pv: currentPv,
              depth: currentDepth || depth,
            });
          }, 15000);

          const onData = (chunk: string | Buffer) => {
            const text = chunk.toString();

            // Phase 1: Wait for readyok to ensure previous search output is completely drained
            if (!isSearching) {
              drainBuf += text;
              if (drainBuf.includes('readyok')) {
                isSearching = true;
                lineBuf = '';

                let positionCmd = `position fen ${fen}`;
                if (moves && Array.isArray(moves)) {
                  const isStartpos =
                    !initialFen ||
                    initialFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
                  if (moves.length === 0) {
                    positionCmd = isStartpos ? 'position startpos' : `position fen ${initialFen}`;
                  } else {
                    positionCmd = isStartpos
                      ? `position startpos moves ${moves.join(' ')}`
                      : `position fen ${initialFen} moves ${moves.join(' ')}`;
                  }
                }

                proc.stdin?.write(`${positionCmd}\ngo depth ${depth}\n`);
              }
              return;
            }

            // Phase 2: Process output exclusively for this position
            lineBuf += text;
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop() || '';

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) continue;

              if (line.startsWith('info') && line.includes('score')) {
                const parts = line.split(/\s+/);
                const scoreIdx = parts.indexOf('score');
                if (scoreIdx !== -1 && scoreIdx + 2 < parts.length) {
                  const type = parts[scoreIdx + 1];
                  const val = parseInt(parts[scoreIdx + 2], 10);
                  if (type === 'cp') {
                    const rawVal = isNaN(val) ? 0 : val;
                    currentScore = rawVal * multiplier;
                    currentMate = null;
                  } else if (type === 'mate') {
                    const rawMate = isNaN(val) ? 0 : val;
                    const normalizedMate = rawMate * multiplier;
                    currentMate = normalizedMate;
                    if (normalizedMate !== 0) {
                      currentScore =
                        normalizedMate > 0
                          ? 10000 - normalizedMate * 100
                          : -10000 - normalizedMate * 100;
                    } else {
                      currentScore = turn === 'w' ? -10000 : 10000;
                    }
                  }
                }

                const depthIdx = parts.indexOf('depth');
                if (depthIdx !== -1 && depthIdx + 1 < parts.length) {
                  currentDepth = parseInt(parts[depthIdx + 1], 10) || 0;
                }

                const pvIdx = parts.indexOf('pv');
                if (pvIdx !== -1) {
                  currentPv = parts.slice(pvIdx + 1, pvIdx + 6).join(' ');
                }
              } else if (line.startsWith('bestmove')) {
                const parts = line.split(/\s+/);
                currentBestMove = parts[1] === '(none)' ? '' : parts[1] || '';

                cleanupAndResolve({
                  score: currentScore,
                  mate: currentMate,
                  bestMove: currentBestMove,
                  pv: currentPv,
                  depth: currentDepth || depth,
                });
                return;
              }
            }
          };

          proc.on('error', onError);
          proc.stdout?.on('data', onData);
          proc.stdin?.write('stop\nisready\n');
        });
      });

      evalQueue = job.catch(() => {});
      return await job;
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Engine operation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
