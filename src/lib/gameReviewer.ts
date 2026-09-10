import { Chess, Square } from 'chess.js';
import { GamePhase, GameReview, MoveAnalysis, MoveClassification, PhaseAccuracy } from '@/types/chess';
import {
  calculateAccuracy,
  calculateEstimatedElo,
  calculateWinRate,
  classifyMove,
  detectPieceSacrifice,
  determineGamePhase,
  gamePhaseCap,
  getHarmonicMean,
  getMoveCommentary,
  parsePgn,
  moveCap,
  stillLosing,
  stillWinning,
  didAWinningCapture,
  positionWinningBy,
  positionEqualish,
  somethingIsAttackedByLowerPiece,
} from './analyzer';
import { identifyOpening, isBookMove } from './openings';
import { engineManager } from './engineManager';

export interface ReviewProgress {
  currentPly: number;
  totalPlies: number;
  percent: number;
  currentMoveSan: string;
  statusText: string;
}

export type ProgressCallback = (progress: ReviewProgress) => void;

export interface RawAnnotation {
  best?: string;
  eval?: number;
  mate?: number | null;
  classification?: MoveClassification;
  text?: string;
}

/**
 * Parses any PGN and loads moves into a Chess instance
 */
export function loadGameFromPgn(pgnString: string): {
  chess: Chess;
  headers: Record<string, string>;
  rawAnnotations: Map<number, RawAnnotation>;
} {
  const { headers, rawMoves } = parsePgn(pgnString);
  const chess = new Chess();
  const rawAnnotations = new Map<number, RawAnnotation>();

  for (let i = 0; i < rawMoves.length; i++) {
    const raw = rawMoves[i];
    const token = raw.rawToken;
    let played = false;

    // Try SAN move
    try {
      const res = chess.move(token);
      if (res) played = true;
    } catch {
      // Try UCI / LAN move
      if (token.length >= 4) {
        try {
          const res = chess.move({
            from: token.slice(0, 2) as Square,
            to: token.slice(2, 4) as Square,
            promotion: token[4] || 'q',
          });
          if (res) played = true;
        } catch {
          // Skip invalid token
        }
      }
    }

    if (
      played &&
      (raw.cachedBest ||
        raw.cachedEval !== undefined ||
        raw.cachedMate !== undefined ||
        raw.cachedClassification ||
        raw.annotation)
    ) {
      rawAnnotations.set(i, {
        best: raw.cachedBest,
        eval: raw.cachedEval,
        mate: raw.cachedMate,
        classification: raw.cachedClassification,
        text: raw.annotation,
      });
    }
  }

  return { chess, headers, rawAnnotations };
}

/**
 * Analyzes full game and computes all Game Review metrics,
 * replicating exact accuracy_full_game logic from ChessAnalyzer/Analyzer.py
 */
export async function analyzeGame(
  pgnString: string,
  analysisDepth: number = 18,
  onProgress?: ProgressCallback,
  abortSignal?: { aborted: boolean },
  forcedEngineName?: string
): Promise<GameReview> {
  const { chess, headers } = loadGameFromPgn(pgnString);
  const history = chess.history({ verbose: true });
  const totalPlies = history.length;

  if (totalPlies === 0) {
    throw new Error('No valid moves found in the provided PGN.');
  }

  const uciMoves: string[] = history.map((m) => m.lan || `${m.from}${m.to}`);
  const openingInfo = identifyOpening(uciMoves);
  const longestBook = openingInfo.bookPlyCount;

  // Build the list of all positions [pos0, pos1, ..., posN] (length totalPlies + 1)
  const positions: string[] = [history[0].before];
  for (let i = 0; i < totalPlies; i++) {
    positions.push(history[i].after);
  }

  const totalPositions = positions.length;
  const activeEngineName = forcedEngineName || engineManager.getActiveEngineName();

  // Data structures matching Analyzer.py
  let alreadyWentEndgame = false;
  const centipawns: number[] = [];
  const centipawns_black: number[] = [];
  const centipawns_mid_game: number[] = [];
  const centipawns_black_mid_game: number[] = [];
  const centipawns_end_game: number[] = [];
  const centipawns_black_end_game: number[] = [];
  const w_best_moves: string[] = [];
  const b_best_moves: string[] = [];
  const mates: (number | null)[] = [];
  const pvs: string[] = [];

  // Prepare engine for game review (single ucinewgame at start, preserving TT & heuristics during the game)
  await engineManager.newGame();

  // Loop through all positions seen in the whole game (Analyzer.py line 212)
  for (let i = 0; i < totalPositions; i++) {
    if (abortSignal?.aborted) {
      throw new Error('Analysis stopped by user.');
    }

    const pos = positions[i];
    const colors = pos.split(' ')[1]; // 'w' or 'b'
    const isWhite = colors === 'w';

    const currentMoveSan = i > 0 ? history[i - 1].san : 'Startpos';
    onProgress?.({
      currentPly: i,
      totalPlies,
      percent: Math.round((i / totalPositions) * 100),
      currentMoveSan,
      statusText: `${activeEngineName} analyzing position ${i + 1}/${totalPositions} (${isWhite ? 'White' : 'Black'} to move) at depth ${analysisDepth}...`,
    });

    let evaluated = 0;
    let bestMove = '';
    let mateIn: number | null = null;
    let pv = '';

    // Check if terminal position
    const testChess = new Chess(pos);
    if (testChess.isGameOver()) {
      if (testChess.isCheckmate()) {
        // Side to move is checkmated:
        // If White is to move, White is checkmated (score -40000)
        // If Black is to move, Black is checkmated (score +40000)
        evaluated = colors === 'w' ? -40000 : 40000;
        mateIn = colors === 'w' ? -1 : 1;
      } else {
        // Draw (stalemate, repetition, material, 50-move)
        evaluated = 0;
        mateIn = null;
      }
      bestMove = '';
    } else {
      // Evaluate with active engine using position startpos moves <m1> <m2> ...
      // preserves engine transposition table and move ordering heuristics across moves
      const sfResult = await engineManager.evaluatePosition(pos, analysisDepth, {
        moves: uciMoves.slice(0, i),
        initialFen: history[0].before,
      });
      evaluated = sfResult.score;
      bestMove = sfResult.bestMove || '';
      mateIn = sfResult.mate;
      pv = sfResult.pv || '';

      if (mateIn !== null) {
        evaluated = (40000 - Math.abs(mateIn)) * (mateIn > 0 ? 1 : -1);
      }
    }

    // Append best move per side (Analyzer.py lines 225-230)
    if (colors === 'w') {
      w_best_moves.push(bestMove);
    } else {
      b_best_moves.push(bestMove);
    }

    // Centipawns from White & Black perspectives (Analyzer.py lines 232-233)
    // Since evaluated is already from White's perspective:
    const cpWhite = evaluated;
    const cpBlack = -evaluated;
    centipawns.push(cpWhite);
    centipawns_black.push(cpBlack);

    const mateWhite = mateIn;
    mates.push(mateWhite);
    pvs.push(pv);

    // Separate lists for middle game and endgame (Analyzer.py lines 236-243)
    const phase = gamePhaseCap(pos);
    if (phase !== 'endgame' && !alreadyWentEndgame) {
      centipawns_mid_game.push(cpWhite);
      centipawns_black_mid_game.push(cpBlack);
    } else {
      if (!alreadyWentEndgame) alreadyWentEndgame = true;
      centipawns_end_game.push(cpWhite);
      centipawns_black_end_game.push(cpBlack);
    }
  }

  // Initialize win rate lists (Analyzer.py lines 249-256)
  const win_rate_lists = centipawns.map((cp) => calculateWinRate(cp));
  const win_rate_lists_black = centipawns_black.map((cp) => calculateWinRate(cp));

  const win_rate_lists_mid = centipawns_mid_game.map((cp) => calculateWinRate(cp));
  const win_rate_lists_black_mid = centipawns_black_mid_game.map((cp) => calculateWinRate(cp));
  const win_rate_lists_end = centipawns_end_game.map((cp) => calculateWinRate(cp));
  const win_rate_lists_black_end = centipawns_black_end_game.map((cp) => calculateWinRate(cp));

  // Get accuracy based on win rates (Analyzer.py lines 259-275)
  const accuracy_lists_mid: number[] = [];
  const accuracy_lists_black_mid: number[] = [];
  for (let i = 0; i < win_rate_lists_mid.length - 1; i++) {
    if (i % 2 === 0) {
      accuracy_lists_mid.push(Math.max(calculateAccuracy(win_rate_lists_mid[i], win_rate_lists_mid[i + 1]), 10.0));
    } else {
      accuracy_lists_black_mid.push(Math.max(calculateAccuracy(win_rate_lists_black_mid[i], win_rate_lists_black_mid[i + 1]), 10.0));
    }
  }

  const accuracy_lists_end: number[] = [];
  const accuracy_lists_black_end: number[] = [];
  for (let i = 0; i < win_rate_lists_end.length - 1; i++) {
    if (i % 2 === 0) {
      accuracy_lists_end.push(Math.max(calculateAccuracy(win_rate_lists_end[i], win_rate_lists_end[i + 1]), 10.0));
    } else {
      accuracy_lists_black_end.push(Math.max(calculateAccuracy(win_rate_lists_black_end[i], win_rate_lists_black_end[i + 1]), 10.0));
    }
  }

  const accuracy_lists: number[] = [];
  const accuracy_lists_black: number[] = [];
  for (let i = 0; i < win_rate_lists.length - 1; i++) {
    if (i % 2 === 0) {
      accuracy_lists.push(Math.max(calculateAccuracy(win_rate_lists[i], win_rate_lists[i + 1]), 10.0));
    } else {
      accuracy_lists_black.push(Math.max(calculateAccuracy(win_rate_lists_black[i], win_rate_lists_black[i + 1]), 10.0));
    }
  }

  // Book moves override (Analyzer.py lines 278-295)
  for (let i = 0; i < longestBook; i++) {
    if (i % 2 === 0) {
      const wIdx = i / 2;
      if (wIdx < accuracy_lists.length) accuracy_lists[wIdx] = 100.0;
      if (wIdx < accuracy_lists_mid.length) {
        accuracy_lists_mid[wIdx] = 100.0;
      } else if (wIdx < accuracy_lists_end.length) {
        accuracy_lists_end[wIdx] = 100.0;
      }
    } else {
      const bIdx = Math.floor(i / 2);
      if (bIdx < accuracy_lists_black.length) accuracy_lists_black[bIdx] = 100.0;
      if (bIdx < accuracy_lists_black_mid.length) {
        accuracy_lists_black_mid[bIdx] = 100.0;
      } else if (bIdx < accuracy_lists_black_end.length) {
        accuracy_lists_black_end[bIdx] = 100.0;
      }
    }
  }

  // Classification counters
  const whiteCounts: Record<MoveClassification, number> = {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
    legendary: 0,
  };

  const blackCounts: Record<MoveClassification, number> = {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    miss: 0,
    blunder: 0,
    legendary: 0,
  };

  const moves: MoveAnalysis[] = [];
  let prevWhiteClass: MoveClassification | undefined = undefined;
  let prevBlackClass: MoveClassification | undefined = undefined;

  for (let p = 0; p < totalPlies; p++) {
    const move = history[p];
    const isWhite = move.color === 'w';
    const moveNumber = Math.floor(p / 2) + 1;
    const uci = move.lan || `${move.from}${move.to}`;
    const fenBefore = move.before;
    const fenAfter = move.after;
    const inBook = isBookMove(uciMoves, p);

    const moveIdx = Math.floor(p / 2);
    const bestMoveUci = isWhite ? w_best_moves[moveIdx] || uci : b_best_moves[moveIdx] || uci;
    const evalAfterCp = centipawns[p + 1];
    const mateAfter = mates[p + 1];
    const mateBefore = mates[p];

    const winRateBefore = isWhite ? win_rate_lists[p] : win_rate_lists_black[p];
    const winRateAfter = isWhite ? win_rate_lists[p + 1] : win_rate_lists_black[p + 1];
    const winRateLoss = Math.max(0, winRateBefore - winRateAfter);

    const chessBefore = new Chess(fenBefore);
    const chessAfter = new Chess(fenAfter);

    const isBestMove = uci.trim().toLowerCase() === bestMoveUci.trim().toLowerCase();

    // Player perspective evaluations (capped at +/- 30000 for mate)
    const evalBeforePlayer =
      mateBefore !== null
        ? isWhite
          ? mateBefore > 0
            ? 30000 - Math.min(mateBefore, 100) * 10
            : -30000 - Math.max(mateBefore, -100) * 10
          : mateBefore < 0
          ? 30000 - Math.min(Math.abs(mateBefore), 100) * 10
          : -30000 - Math.max(mateBefore, -100) * 10
        : isWhite
        ? centipawns[p]
        : -centipawns[p];

    const evalAfterPlayer =
      mateAfter !== null
        ? isWhite
          ? mateAfter > 0
            ? 30000 - Math.min(mateAfter, 100) * 10
            : -30000 - Math.max(mateAfter, -100) * 10
          : mateAfter < 0
          ? 30000 - Math.min(Math.abs(mateAfter), 100) * 10
          : -30000 - Math.max(mateAfter, -100) * 10
        : isWhite
        ? evalAfterCp
        : -evalAfterCp;

    const evalLossCp = Math.max(0, evalBeforePlayer - evalAfterPlayer);

    const hadForcedMate = isWhite
      ? mateBefore !== null && mateBefore > 0
      : mateBefore !== null && mateBefore < 0;

    const hasForcedMateAfter = isWhite
      ? mateAfter !== null && mateAfter > 0
      : mateAfter !== null && mateAfter < 0;

    const hasOpponentForcedMateAfter = isWhite
      ? mateAfter !== null && mateAfter < 0
      : mateAfter !== null && mateAfter > 0;

    // Detect genuine sound piece sacrifice
    const lastMove = p > 0 ? history[p - 1] : undefined;
    const sacResult = detectPieceSacrifice(
      chessBefore,
      chessAfter,
      {
        from: move.from as Square,
        to: move.to as Square,
        piece: move.piece,
        captured: move.captured,
        color: move.color,
      },
      lastMove
        ? {
            from: lastMove.from as Square,
            to: lastMove.to as Square,
            piece: lastMove.piece,
            captured: lastMove.captured,
          }
        : undefined
    );
    const isSacrifice = sacResult.isSacrifice;

    // Unified mathematical classification
    const classification = classifyMove({
      uci,
      bestMoveUci,
      evalBeforePlayer,
      evalAfterPlayer,
      winRateBefore,
      winRateAfter,
      winRateLoss,
      evalLossCp,
      isBook: inBook,
      isSacrifice,
      hadForcedMate,
      hasForcedMateAfter,
      hasOpponentForcedMateAfter,
      previousPlayerClassification: isWhite ? prevWhiteClass : prevBlackClass,
      previousOpponentClassification: isWhite ? prevBlackClass : prevWhiteClass,
    });

    if (isWhite) {
      prevWhiteClass = classification;
      whiteCounts[classification] = (whiteCounts[classification] || 0) + 1;
    } else {
      prevBlackClass = classification;
      blackCounts[classification] = (blackCounts[classification] || 0) + 1;
    }

    // Move accuracy bounded to 0..100%
    let moveAcc = calculateAccuracy(winRateBefore, winRateAfter);
    if (inBook || isBestMove) {
      moveAcc = 100.0;
    } else if (classification === 'blunder') {
      moveAcc = Math.min(moveAcc, 25.0);
    } else if (classification === 'miss') {
      moveAcc = Math.min(moveAcc, 38.0);
    } else if (classification === 'mistake') {
      moveAcc = Math.min(moveAcc, 48.0);
    } else if (classification === 'inaccuracy') {
      moveAcc = Math.min(moveAcc, 68.0);
    }

    if (isWhite) {
      accuracy_lists[moveIdx] = moveAcc;
    } else {
      accuracy_lists_black[moveIdx] = moveAcc;
    }

    // Display string
    let displayEval = '';
    if (mateAfter !== null) {
      displayEval = mateAfter === 0 ? 'M0' : (mateAfter > 0 ? `M${mateAfter}` : `-M${Math.abs(mateAfter)}`);
    } else {
      const pawns = (evalAfterCp / 100).toFixed(1);
      displayEval = evalAfterCp > 0 ? `+${pawns}` : pawns;
    }

    // Best move SAN
    let bestMoveSan = bestMoveUci;
    if (bestMoveUci && bestMoveUci.length >= 4) {
      try {
        const testM = new Chess(fenBefore).move({
          from: bestMoveUci.slice(0, 2) as Square,
          to: bestMoveUci.slice(2, 4) as Square,
          promotion: bestMoveUci[4] || 'q',
        });
        if (testM) bestMoveSan = testM.san;
      } catch {}
    }

    const commentary = getMoveCommentary(classification, move.san, bestMoveSan, activeEngineName);

    moves.push({
      ply: p + 1,
      moveNumber,
      color: move.color,
      san: move.san,
      uci,
      from: move.from,
      to: move.to,
      captured: move.captured,
      promotion: move.promotion,
      fenBefore,
      fenAfter,
      score: evalAfterCp,
      mate: mateAfter,
      displayEval,
      winRateBefore: Math.round(winRateBefore * 10) / 10,
      winRateAfter: Math.round(winRateAfter * 10) / 10,
      winRateLoss: Math.round(winRateLoss * 10) / 10,
      accuracy: moveAcc,
      classification,
      bestMoveUci,
      bestMoveSan,
      bestMoveScore: evalAfterCp,
      bestMoveMate: mateAfter,
      pv: pvs[p] || '',
      commentary,
      isSacrifice,
      gamePhase: determineGamePhase(fenBefore),
    });
  }

  // Clipping to [10.0, 500.0] and Harmonic Mean
  const clipped_white = accuracy_lists.map((a) => Math.max(10.0, Math.min(500.0, a)));
  const clipped_black = accuracy_lists_black.map((a) => Math.max(10.0, Math.min(500.0, a)));

  const whiteAccuracy = Math.round(Math.min(getHarmonicMean(clipped_white), 100.0) * 10) / 10;
  const blackAccuracy = Math.round(Math.min(getHarmonicMean(clipped_black), 100.0) * 10) / 10;

  const whitePhaseAccuracy: PhaseAccuracy = {
    opening: Math.round(Math.min(getHarmonicMean(accuracy_lists_mid.slice(0, 5)), 100.0) * 10) / 10 || 100,
    middlegame: Math.round(Math.min(getHarmonicMean(accuracy_lists_mid), 100.0) * 10) / 10 || whiteAccuracy,
    endgame: Math.round(Math.min(getHarmonicMean(accuracy_lists_end), 100.0) * 10) / 10 || whiteAccuracy,
  };

  const blackPhaseAccuracy: PhaseAccuracy = {
    opening: Math.round(Math.min(getHarmonicMean(accuracy_lists_black_mid.slice(0, 5)), 100.0) * 10) / 10 || 100,
    middlegame: Math.round(Math.min(getHarmonicMean(accuracy_lists_black_mid), 100.0) * 10) / 10 || blackAccuracy,
    endgame: Math.round(Math.min(getHarmonicMean(accuracy_lists_black_end), 100.0) * 10) / 10 || blackAccuracy,
  };

  const whiteEstimatedElo = calculateEstimatedElo(whiteAccuracy);
  const blackEstimatedElo = calculateEstimatedElo(blackAccuracy);

  let winner: 'w' | 'b' | 'draw' | null = null;
  if (headers.Result === '1-0') winner = 'w';
  else if (headers.Result === '0-1') winner = 'b';
  else if (headers.Result === '1/2-1/2') winner = 'draw';

  return {
    headers,
    moves,
    whiteAccuracy,
    blackAccuracy,
    whitePhaseAccuracy,
    blackPhaseAccuracy,
    whiteCounts,
    blackCounts,
    whiteEstimatedElo,
    blackEstimatedElo,
    openingName: openingInfo.name,
    openingEco: openingInfo.eco,
    analyzedDepth: analysisDepth,
    engineName: activeEngineName,
    totalMoves: Math.ceil(totalPlies / 2),
    result: headers.Result || '*',
    winner,
  };
}
