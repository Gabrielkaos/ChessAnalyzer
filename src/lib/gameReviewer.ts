import { Chess, Square } from 'chess.js';
import { GamePhase, GameReview, MoveAnalysis, MoveClassification, PhaseAccuracy } from '@/types/chess';
import {
  calculateAccuracy,
  calculateEstimatedElo,
  calculateWinRate,
  classifyMove,
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
  analysisDepth: number = 20,
  onProgress?: ProgressCallback,
  abortSignal?: { aborted: boolean }
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
  const activeEngineName = engineManager.getActiveEngineName();

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
  let prevClassification: MoveClassification | undefined = undefined;

  for (let p = 0; p < totalPlies; p++) {
    const move = history[p];
    const isWhite = move.color === 'w';
    const moveNumber = Math.floor(p / 2) + 1;
    const uci = move.lan || `${move.from}${move.to}`;
    const fenBefore = move.before;
    const fenAfter = move.after;
    const inBook = isBookMove(uciMoves, p);

    const moveIdx = Math.floor(p / 2);
    let rawAcc = isWhite ? accuracy_lists[moveIdx] : accuracy_lists_black[moveIdx];
    let moveAcc = Math.round((rawAcc ?? 100) * 10) / 10;

    const bestMoveUci = isWhite ? w_best_moves[moveIdx] || uci : b_best_moves[moveIdx] || uci;
    const evalAfterCp = centipawns[p + 1];
    const mateAfter = mates[p + 1];
    const mateBefore = mates[p];

    const winRateBefore = isWhite ? win_rate_lists[p] : win_rate_lists_black[p];
    const winRateAfter = isWhite ? win_rate_lists[p + 1] : win_rate_lists_black[p + 1];
    const winRateLoss = Math.max(0, winRateBefore - winRateAfter);

    const chessBefore = new Chess(fenBefore);
    const chessAfter = new Chess(fenAfter);
    const side: 'w' | 'b' = isWhite ? 'w' : 'b';
    const oppSide: 'w' | 'b' = isWhite ? 'b' : 'w';

    const isBestMove = uci.trim().toLowerCase() === bestMoveUci.trim().toLowerCase();

    // Player perspective evaluations (capped at +/- 30000 for mate)
    const evalBeforePlayer =
      mateBefore !== null
        ? isWhite
          ? mateBefore > 0
            ? 30000
            : -30000
          : mateBefore < 0
          ? 30000
          : -30000
        : isWhite
        ? centipawns[p]
        : -centipawns[p];

    const evalAfterPlayer =
      mateAfter !== null
        ? isWhite
          ? mateAfter > 0
            ? 30000
            : -30000
          : mateAfter < 0
          ? 30000
          : -30000
        : isWhite
        ? evalAfterCp
        : -evalAfterCp;

    const evalLossCp = evalBeforePlayer - evalAfterPlayer;

    const hadForcedMate = isWhite
      ? mateBefore !== null && mateBefore > 0
      : mateBefore !== null && mateBefore < 0;

    const hasForcedMateAfter = isWhite
      ? mateAfter !== null && mateAfter > 0
      : mateAfter !== null && mateAfter < 0;

    // 1. Initial move classification (Run_gui.py lines 36-58)
    let moveClass: MoveClassification = moveCap(moveAcc, uci, bestMoveUci);

    // 1b. Handle Missed Forced Checkmate & Massive Centipawn Drops in Winning Positions
    // (Fixes sigmoid saturation where losing M7 -> +11.3 was classified as "Excellent")
    if (!isBestMove && !inBook) {
      if (hadForcedMate && !hasForcedMateAfter) {
        // Player had a forced checkmate, but played a move that threw it away!
        if (evalLossCp >= 300 || move.piece === 'q') {
          // Blundered queen, piece, or dropped massive eval -> BLUNDER
          moveClass = 'blunder';
          moveAcc = Math.min(moveAcc, 18.0);
        } else {
          // Threw away forced mate, but still winning comfortably without hanging a piece -> MISS
          moveClass = 'miss';
          moveAcc = Math.min(moveAcc, 40.0);
        }
        if (isWhite) accuracy_lists[moveIdx] = moveAcc;
        else accuracy_lists_black[moveIdx] = moveAcc;
      } else if (evalBeforePlayer >= 300) {
        // Player was winning by at least 3 pawns
        if (evalLossCp >= 500) {
          // Blundered a queen, rook, or 5+ pawns -> BLUNDER
          moveClass = 'blunder';
          moveAcc = Math.min(moveAcc, 18.0);
          if (isWhite) accuracy_lists[moveIdx] = moveAcc;
          else accuracy_lists_black[moveIdx] = moveAcc;
        } else if (evalLossCp >= 300) {
          // Blundered a minor piece -> MISTAKE
          moveClass = 'mistake';
          moveAcc = Math.min(moveAcc, 38.0);
          if (isWhite) accuracy_lists[moveIdx] = moveAcc;
          else accuracy_lists_black[moveIdx] = moveAcc;
        } else if (evalLossCp >= 150) {
          // Noticeable inaccuracy
          if (['excellent', 'best', 'good'].includes(moveClass)) {
            moveClass = 'inaccuracy';
            moveAcc = Math.min(moveAcc, 62.0);
            if (isWhite) accuracy_lists[moveIdx] = moveAcc;
            else accuracy_lists_black[moveIdx] = moveAcc;
          }
        }
      }
    }

    // 2. Contextual evaluation variables (Run_gui.py lines 341-348, 380-387)
    const inCheckEarlier = chessBefore.inCheck();
    const hangedEarlier = somethingIsAttackedByLowerPiece(chessBefore, side);
    const isPieceRQ = move.piece === 'r' || move.piece === 'q';
    const didWinningCap = didAWinningCapture(move.captured, move.piece);
    const isSacrifice = Boolean((hangedEarlier || isPieceRQ) && !didWinningCap && !inCheckEarlier);

    // In Run_gui.py, eval is White's perspective centipawns
    const currentEval = evalAfterCp;

    // 3. Sacrifice logic from Run_gui.py lines 350-365 (White) & lines 397-415 (Black):
    if (!['blunder', 'mistake', 'inaccuracy', 'good'].includes(moveClass)) {
      if (mateAfter === null) {
        const condEqualOrOppBlunder =
          positionEqualish(currentEval) ||
          (prevClassification &&
            ['blunder', 'mistake'].includes(prevClassification) &&
            !positionWinningBy(oppSide, currentEval));

        const attackedLower =
          somethingIsAttackedByLowerPiece(chessAfter, side, true) ||
          somethingIsAttackedByLowerPiece(chessAfter, side, false);

        if (
          condEqualOrOppBlunder &&
          attackedLower &&
          !['brilliant', 'legendary'].includes(moveClass) &&
          !inCheckEarlier &&
          !didWinningCap
        ) {
          if (hangedEarlier || isPieceRQ) {
            moveClass = 'brilliant';
          } else {
            moveClass = 'great';
            if (prevClassification === 'blunder') moveClass = 'great';
            if (prevClassification === 'mistake') moveClass = 'brilliant';
          }
        }
      }
    }

    // 4. Filtering brilliant moves from Run_gui.py lines 418-427:
    // "filtering brilliant moves, don't make it brilliant if we are still losing also if we are winning in way high margin"
    if (mateAfter === null && moveClass === 'brilliant') {
      if (stillLosing(currentEval, side) || stillWinning(currentEval, side)) {
        moveClass = 'best';
      }
    }

    // 5. If earlier move was blunder and current move is best/excellent, it is great (Run_gui.py lines 428-434):
    if (prevClassification === 'blunder' && ['best', 'excellent'].includes(moveClass)) {
      moveClass = 'great';
    }

    // 5b. Guard winning queen/major piece captures from ever being classified as blunder or mistake while winning
    if (['blunder', 'mistake'].includes(moveClass) && didWinningCap && stillWinning(currentEval, side)) {
      moveClass = prevClassification === 'blunder' ? 'great' : 'best';
    }

    // 6. If consecutive moves are both brilliant/great/legendary of same type (Run_gui.py lines 438-446):
    if (
      prevClassification &&
      ['great', 'legendary', 'brilliant'].includes(moveClass) &&
      prevClassification === moveClass
    ) {
      moveClass = 'best';
    }

    // 7. Flag book moves (Run_gui.py lines 448-450):
    if (inBook) {
      moveClass = 'book';
    }

    const classification: MoveClassification = moveClass;
    prevClassification = classification;

    if (isWhite) {
      whiteCounts[classification] = (whiteCounts[classification] || 0) + 1;
    } else {
      blackCounts[classification] = (blackCounts[classification] || 0) + 1;
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
