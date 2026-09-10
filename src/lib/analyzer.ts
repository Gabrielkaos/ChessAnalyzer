import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { GamePhase, MoveAnalysis, MoveClassification, PhaseAccuracy, GameReview } from '@/types/chess';
import { identifyOpening, isBookMove } from './openings';

export function calculateWinRate(centipawns: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1);
}

export function calculateAccuracy(winBefore: number, winAfter: number): number {
  const winRateLoss = Math.max(0, winBefore - winAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * winRateLoss) - 3.1669;
  return Math.max(0, Math.min(100, Math.round(acc * 10) / 10));
}

export function getHarmonicMean(num: number[]): number {
  if (!num || num.length === 0) return 0.0;
  let average = 0;
  for (const i of num) {
    average += 1.0 / i;
  }
  return num.length / average;
}

export function calculateEstimatedElo(accuracy: number, baseElo: number = 3000): number {
  return Math.round(baseElo * (accuracy / 100.0));
}

/**
 * Exact game phase calculation from Other_functions.py:
 * game_phase = 24 minus knights(1), bishops(1), rooks(2), queens(4)
 * phase_score = (game_phase * 256 + 12) / 24
 * < 43 -> opening, 43 <= phase < 171 -> middle game, >= 171 -> endgame
 */
export function getGamePhaseValue(fen: string): number {
  const piecePlacement = fen.split(' ')[0];
  let game_phase = 24;
  for (const char of piecePlacement) {
    if (char === 'n' || char === 'N') game_phase -= 1;
    else if (char === 'b' || char === 'B') game_phase -= 1;
    else if (char === 'r' || char === 'R') game_phase -= 2;
    else if (char === 'q' || char === 'Q') game_phase -= 4;
  }
  return (game_phase * 256 + 12) / 24;
}

export function determineGamePhase(fen: string): GamePhase {
  const phase = getGamePhaseValue(fen);
  if (phase < 43) return 'opening';
  if (phase < 171) return 'middlegame';
  return 'endgame';
}

export const gamePhaseCap = determineGamePhase;

export const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 10000,
};

export interface PieceAttacker {
  type: PieceSymbol;
  square: Square;
  value: number;
}

/**
 * Returns all pieces of attackingColor that attack the given square.
 */
export function getAttackers(
  chess: Chess,
  square: Square,
  attackingColor: Color
): PieceAttacker[] {
  const board = chess.board();
  const file = square.charCodeAt(0) - 97; // 'a' -> 0, 'h' -> 7
  const rank = 8 - parseInt(square[1], 10); // '8' -> 0, '1' -> 7
  const attackers: PieceAttacker[] = [];

  // 1. Pawn attacks
  const pawnRank = attackingColor === 'w' ? rank + 1 : rank - 1;
  for (const pawnFile of [file - 1, file + 1]) {
    if (pawnRank >= 0 && pawnRank < 8 && pawnFile >= 0 && pawnFile < 8) {
      const p = board[pawnRank][pawnFile];
      if (p && p.color === attackingColor && p.type === 'p') {
        attackers.push({ type: 'p', square: p.square, value: 100 });
      }
    }
  }

  // 2. Knight attacks
  const knightDeltas: [number, number][] = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, df] of knightDeltas) {
    const nr = rank + dr;
    const nf = file + df;
    if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
      const p = board[nr][nf];
      if (p && p.color === attackingColor && p.type === 'n') {
        attackers.push({ type: 'n', square: p.square, value: 300 });
      }
    }
  }

  // 3. King attacks
  for (let dr = -1; dr <= 1; dr++) {
    for (let df = -1; df <= 1; df++) {
      if (dr === 0 && df === 0) continue;
      const kr = rank + dr;
      const kf = file + df;
      if (kr >= 0 && kr < 8 && kf >= 0 && kf < 8) {
        const p = board[kr][kf];
        if (p && p.color === attackingColor && p.type === 'k') {
          attackers.push({ type: 'k', square: p.square, value: 10000 });
        }
      }
    }
  }

  // 4. Raycasting diagonals (bishops & queens)
  const diagDirs: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, df] of diagDirs) {
    let r = rank + dr;
    let f = file + df;
    while (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const p = board[r][f];
      if (p) {
        if (p.color === attackingColor && (p.type === 'b' || p.type === 'q')) {
          attackers.push({ type: p.type, square: p.square, value: PIECE_VALUES[p.type] || 0 });
        }
        break;
      }
      r += dr;
      f += df;
    }
  }

  // 5. Raycasting orthogonals (rooks & queens)
  const orthDirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, df] of orthDirs) {
    let r = rank + dr;
    let f = file + df;
    while (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const p = board[r][f];
      if (p) {
        if (p.color === attackingColor && (p.type === 'r' || p.type === 'q')) {
          attackers.push({ type: p.type, square: p.square, value: PIECE_VALUES[p.type] || 0 });
        }
        break;
      }
      r += dr;
      f += df;
    }
  }

  return attackers;
}

/**
 * Checks whether a friendly piece is en prise (can be captured for material gain).
 */
export function isPieceEnPrise(
  chess: Chess,
  square: Square,
  pieceType: PieceSymbol,
  pieceColor: Color
): boolean {
  const oppColor: Color = pieceColor === 'w' ? 'b' : 'w';
  const attackers = getAttackers(chess, square, oppColor);
  if (attackers.length === 0) return false;

  const defenders = getAttackers(chess, square, pieceColor);
  const pieceVal = PIECE_VALUES[pieceType] || 0;

  // Attacked by a strictly lower-value piece (e.g. pawn attacks knight/bishop/rook/queen)
  const lowestAttackerVal = Math.min(...attackers.map((a) => a.value));
  if (pieceVal - lowestAttackerVal >= 150) {
    return true;
  }

  // Completely undefended
  if (defenders.length === 0) {
    return true;
  }

  // Overloaded: more attackers than defenders
  if (attackers.length > defenders.length) {
    return true;
  }

  return false;
}

export interface SacrificeDetection {
  isSacrifice: boolean;
  sacrificedPiece?: PieceSymbol;
  square?: Square;
  netMaterialRisked?: number;
}

/**
 * Detects whether a move is a genuine piece sacrifice (minor piece, rook, queen, or exchange).
 * Excludes trades, equal recaptures, and pawn moves.
 */
export function detectPieceSacrifice(
  chessBefore: Chess,
  chessAfter: Chess,
  move: { from: Square; to: Square; piece: PieceSymbol; captured?: PieceSymbol; color: Color },
  lastMove?: { from: Square; to: Square; piece: PieceSymbol; captured?: PieceSymbol }
): SacrificeDetection {
  const movingColor = move.color;

  // Exclude direct equal/winning recaptures on the same square
  if (lastMove && lastMove.to === move.to && move.captured) {
    const movedVal = PIECE_VALUES[move.piece] || 0;
    const capturedVal = PIECE_VALUES[move.captured] || 0;
    if (capturedVal >= movedVal) {
      return { isSacrifice: false };
    }
  }

  // 1. Active sacrifice: The moved piece lands on an attacked square risking material
  if (move.piece !== 'p' && move.piece !== 'k') {
    const pieceVal = PIECE_VALUES[move.piece] || 0;
    const capturedVal = move.captured ? (PIECE_VALUES[move.captured] || 0) : 0;
    const netMaterialRisked = pieceVal - capturedVal;

    // Must be risking significant net material (e.g. Rook for Bishop/Knight = 200, Queen sacrifice = 400+, or pure piece offer = 300+)
    if (netMaterialRisked >= 150) {
      if (isPieceEnPrise(chessAfter, move.to, move.piece, movingColor)) {
        return {
          isSacrifice: true,
          sacrificedPiece: move.piece,
          square: move.to,
          netMaterialRisked,
        };
      }
    }
  }

  // 2. Passive sacrifice: Another friendly major or minor piece left en prise
  const boardAfter = chessAfter.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = boardAfter[r][c];
      if (!p || p.color !== movingColor) continue;
      if (p.type === 'p' || p.type === 'k') continue;
      if (p.square === move.to) continue;

      const pVal = PIECE_VALUES[p.type] || 0;
      if (pVal < 300) continue;

      if (isPieceEnPrise(chessAfter, p.square, p.type, movingColor)) {
        const wasEnPriseBefore = isPieceEnPrise(chessBefore, p.square, p.type, movingColor);
        if (!wasEnPriseBefore) {
          return {
            isSacrifice: true,
            sacrificedPiece: p.type,
            square: p.square,
            netMaterialRisked: pVal,
          };
        }
      }
    }
  }

  return { isSacrifice: false };
}

export interface ClassifyInput {
  accuracy?: number;
  uci: string;
  bestMoveUci: string;
  winRateLoss?: number;
  evalLossCp?: number;
  evalBeforePlayer?: number;
  evalAfterPlayer?: number;
  winRateBefore?: number;
  winRateAfter?: number;
  isBook: boolean;
  isSacrifice?: boolean;
  hadForcedMate?: boolean;
  hasForcedMateAfter?: boolean;
  hasOpponentForcedMateAfter?: boolean;
  previousPlayerClassification?: MoveClassification;
  previousOpponentClassification?: MoveClassification;

  // Backward compatibility fields
  evalBefore?: number;
  evalAfter?: number;
  previousMoveClassification?: MoveClassification;
  wasOpponentBlunderOrMistake?: boolean;
}

/**
 * Standard move classification based on move accuracy alone.
 */
export function moveCap(
  acc: number,
  moveUci?: string,
  bestMoveUci?: string
): MoveClassification {
  if (
    moveUci &&
    bestMoveUci &&
    moveUci.trim().toLowerCase() === bestMoveUci.trim().toLowerCase()
  ) {
    return 'best';
  }

  if (acc >= 90.0) return 'excellent';
  if (acc >= 78.0) return 'good';
  if (acc >= 58.0) return 'inaccuracy';
  if (acc >= 35.0) return 'mistake';
  return 'blunder';
}

/**
 * Exact helper functions preserved for backward compatibility
 */
export function stillLosing(evaluation: number, side: 'w' | 'b'): boolean {
  return side === 'b' ? evaluation >= 500 : evaluation <= -500;
}

export function stillWinning(evaluation: number, side: 'w' | 'b'): boolean {
  return side === 'w' ? (evaluation - 63) >= 500 : (evaluation + 63) <= -500;
}

export function didAWinningCapture(capturedPiece?: string, movingPiece?: string): boolean {
  if (!capturedPiece) return false;
  const capturedVal = PIECE_VALUES[capturedPiece.toLowerCase()] || 0;
  const movingVal = PIECE_VALUES[movingPiece?.toLowerCase() || 'p'] || 100;
  return capturedVal >= movingVal;
}

export function positionWinningBy(side: 'w' | 'b', evaluation: number): boolean {
  if (Math.abs(evaluation) >= 300) {
    if (evaluation > 0 && side === 'w') return true;
    if (evaluation < 0 && side === 'b') return true;
  }
  return false;
}

export function positionEqualish(evaluation: number): boolean {
  return Math.abs(evaluation) < 300;
}

export function somethingIsAttackedByLowerPiece(
  chess: Chess,
  sideToCheck: 'w' | 'b',
  isPawn: boolean = false
): boolean {
  if (isPawn) {
    return chess.inCheck();
  }
  const oppColor: Color = sideToCheck === 'w' ? 'b' : 'w';
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== sideToCheck) continue;
      if (p.type === 'p' || p.type === 'k') continue;
      const attackers = getAttackers(chess, p.square, oppColor);
      const pVal = PIECE_VALUES[p.type] || 0;
      if (attackers.some((a) => a.value < pVal)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Fair, mathematical, and context-aware move classification.
 * Matches modern Chess.com expected points and piece sacrifice models.
 */
export function classifyMove(input: ClassifyInput): MoveClassification {
  if (input.isBook) return 'book';

  const uci = (input.uci || '').trim().toLowerCase();
  const bestUci = (input.bestMoveUci || '').trim().toLowerCase();
  const isBestMove = uci.length > 0 && bestUci.length > 0 && uci === bestUci;

  const evalBefore = input.evalBeforePlayer !== undefined ? input.evalBeforePlayer : (input.evalBefore ?? 0);
  const evalAfter = input.evalAfterPlayer !== undefined ? input.evalAfterPlayer : (input.evalAfter ?? 0);
  const evalLossCp = input.evalLossCp !== undefined
    ? input.evalLossCp
    : Math.max(0, evalBefore - evalAfter);

  const winRateBefore = input.winRateBefore !== undefined ? input.winRateBefore : calculateWinRate(evalBefore);
  const winRateAfter = input.winRateAfter !== undefined ? input.winRateAfter : calculateWinRate(evalAfter);
  const winRateLoss = input.winRateLoss !== undefined
    ? input.winRateLoss
    : Math.max(0, winRateBefore - winRateAfter);

  const isTieForBest = winRateLoss <= 0.4 && evalLossCp <= 12;
  const isOptimal = isBestMove || isTieForBest;

  const prevOppClass = input.previousOpponentClassification || (input.wasOpponentBlunderOrMistake ? 'blunder' : undefined);
  const prevPlayerClass = input.previousPlayerClassification || input.previousMoveClassification;

  // 1. Brilliant: Rare, sound piece sacrifice maintaining clear advantage
  const isSoundSacrifice =
    Boolean(input.isSacrifice) &&
    isOptimal &&
    evalAfter >= -40 &&
    winRateAfter >= 48 &&
    (evalBefore <= 750 || Boolean(input.hasForcedMateAfter)) &&
    prevPlayerClass !== 'brilliant';

  if (isSoundSacrifice) {
    return 'brilliant';
  }

  // 2. Great: Critical best move (turning point, clutch defense, or punishing a blunder)
  const isOpponentMistakeOrBlunder =
    prevOppClass === 'blunder' || prevOppClass === 'mistake';

  const isCriticalTurningPoint =
    (evalBefore <= 100 || winRateBefore <= 55) &&
    (evalAfter >= 220 || Boolean(input.hasForcedMateAfter));

  const isPunishingBlunder =
    isOpponentMistakeOrBlunder && evalAfter >= 150 && evalLossCp <= 10;

  const isClutchDefense =
    evalBefore <= -150 &&
    evalAfter >= -50 &&
    (evalAfter - evalBefore) >= 150;

  const isGreatMove =
    isOptimal &&
    prevPlayerClass !== 'great' &&
    (isCriticalTurningPoint || isPunishingBlunder || isClutchDefense);

  if (isGreatMove) {
    return 'great';
  }

  // 3. Best: Top engine move or virtually identical
  if (isOptimal) {
    return 'best';
  }

  // 4. Miss: Missed win or missed tactical punish without hanging own king/pieces
  const hadDecisiveAdvantage =
    Boolean(input.hadForcedMate) ||
    evalBefore >= 250 ||
    isOpponentMistakeOrBlunder;

  const lostDecisiveAdvantage =
    (Boolean(input.hadForcedMate) && !input.hasForcedMateAfter) ||
    evalLossCp >= 150 ||
    winRateLoss >= 10.0;

  const didNotSelfDestruct =
    evalAfter >= -200 && !input.hasOpponentForcedMateAfter;

  if (hadDecisiveAdvantage && lostDecisiveAdvantage && didNotSelfDestruct) {
    return 'miss';
  }

  // 5. Blunder: Massive loss, blundering mate against oneself, or losing > 300 cp
  if (
    (Boolean(input.hasOpponentForcedMateAfter) && !input.hadForcedMate) ||
    winRateLoss > 22.0 ||
    evalLossCp > 300
  ) {
    return 'blunder';
  }

  // 6. Mistake: Noticeable tactical error or dropping 150-300 cp
  if (winRateLoss > 12.0 || evalLossCp > 150) {
    return 'mistake';
  }

  // 7. Inaccuracy: Sub-optimal move dropping 65-150 cp
  if (winRateLoss > 5.0 || evalLossCp > 65) {
    return 'inaccuracy';
  }

  // 8. Good: Minor concession dropping 30-65 cp
  if (winRateLoss > 2.0 || evalLossCp > 30) {
    return 'good';
  }

  // 9. Excellent: Very close to best move (<= 30 cp, <= 2.0% win rate loss)
  return 'excellent';
}

export function getMoveCommentary(
  classification: MoveClassification,
  san: string,
  bestSan: string,
  engineName: string = 'Engine'
): string {
  switch (classification) {
    case 'legendary':
      return `🌟 A legendary move! You found the decisive stroke that turns the game completely!`;
    case 'brilliant':
      return `✨ Brilliant move! You found a stunning sacrifice that keeps the advantage!`;
    case 'great':
      return `🎯 Great move! You capitalized effectively on your opponent's error.`;
    case 'best':
      return `★ Best move! ${engineName} agrees with ${san}.`;
    case 'excellent':
      return `✓ Excellent move! Maintaining strong pressure and high accuracy.`;
    case 'good':
      return `👍 Good move, keeping the position balanced and solid.`;
    case 'book':
      return `📖 Standard opening book move.`;
    case 'inaccuracy':
      return `⚠️ Inaccuracy. ${bestSan ? `Better was ${bestSan}.` : ''}`;
    case 'mistake':
      return `❓ Mistake. This gives your opponent a noticeable advantage. ${bestSan ? `Best was ${bestSan}.` : ''}`;
    case 'miss':
      return `✕ Missed win! You had a decisive opportunity. ${bestSan ? `Best was ${bestSan}.` : ''}`;
    case 'blunder':
      return `?? Blunder! This shifts the game heavily in your opponent's favor. ${bestSan ? `Best was ${bestSan}.` : ''}`;
    default:
      return '';
  }
}

export interface ParsedRawMove {
  moveNumber: number;
  color: 'w' | 'b';
  rawToken: string;
  annotation?: string;
  cachedBest?: string;
  cachedEval?: number;
  cachedMate?: number | null;
  cachedClassification?: MoveClassification;
}

export function parsePgn(pgnString: string): {
  headers: Record<string, string>;
  rawMoves: ParsedRawMove[];
} {
  const headers: Record<string, string> = {
    Event: 'Casual Game',
    Site: 'Chess Analyzer Web',
    Date: new Date().toISOString().split('T')[0],
    Round: '1',
    White: 'White Player',
    Black: 'Black Player',
    Result: '*',
    WhiteElo: '1500',
    BlackElo: '1500',
  };

  // 1. Extract headers [Tag "Value"] or [Tag 'Value']
  const headerRegex = /\[(\w+)\s+["'](.*?)["']\]/g;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(pgnString)) !== null) {
    headers[match[1]] = match[2];
  }

  // 2. Remove headers
  const withoutHeaders = pgnString.replace(/\[.*?\]/g, ' ');

  // 3. Tokenize moves and braces
  // Handles {best=...} comments
  const tokenRegex = /(\d+)\.+|(\{.*?\})|([a-zA-Z0-9+=#\-]+)/g;
  const rawMoves: ParsedRawMove[] = [];

  let currentMoveNumber = 1;
  let currentColor: 'w' | 'b' = 'w';
  let lastMoveObj: ParsedRawMove | null = null;

  let tokenMatch: RegExpExecArray | null;
  while ((tokenMatch = tokenRegex.exec(withoutHeaders)) !== null) {
    const [full, moveNum, braceComment, moveToken] = tokenMatch;

    if (moveNum) {
      currentMoveNumber = parseInt(moveNum, 10);
      currentColor = 'w';
    } else if (braceComment && lastMoveObj) {
      const content = braceComment.slice(1, -1).trim();
      lastMoveObj.annotation = content;

      // Parse classification e.g. "book", "blunder", "great", "excellent"
      const classMatch = /^(legendary|brilliant|great|best|excellent|good|book|inaccuracy|mistake|miss|blunder)\b/i.exec(content);
      if (classMatch) {
        lastMoveObj.cachedClassification = classMatch[1].toLowerCase() as MoveClassification;
      }

      // Parse best move e.g. "best=e2e4" or "best=f1b5"
      const bestMatch = /best=([a-h1-8]{4,5})/i.exec(content);
      if (bestMatch) {
        lastMoveObj.cachedBest = bestMatch[1];
      }

      // Parse eval or mate e.g. "=38", "=-369", "=M-14", "=M0"
      const evalMatch = /=(-?\d+|M-?\d+)\s*$/i.exec(content);
      if (evalMatch) {
        const val = evalMatch[1];
        if (val.toUpperCase().startsWith('M')) {
          const mateIn = parseInt(val.slice(1), 10);
          lastMoveObj.cachedMate = isNaN(mateIn) ? 0 : mateIn;
          lastMoveObj.cachedEval = lastMoveObj.cachedMate === 0
            ? -40000
            : (40000 - Math.abs(lastMoveObj.cachedMate)) * (lastMoveObj.cachedMate > 0 ? 1 : -1);
        } else {
          lastMoveObj.cachedEval = parseInt(val, 10);
          lastMoveObj.cachedMate = null;
        }
      }
    } else if (moveToken) {
      if (['1-0', '0-1', '1/2-1/2', '*'].includes(moveToken)) {
        headers.Result = moveToken;
        break;
      }

      const moveObj: ParsedRawMove = {
        moveNumber: currentMoveNumber,
        color: currentColor,
        rawToken: moveToken,
      };

      rawMoves.push(moveObj);
      lastMoveObj = moveObj;

      if (currentColor === 'w') {
        currentColor = 'b';
      } else {
        currentColor = 'w';
        currentMoveNumber++;
      }
    }
  }

  return { headers, rawMoves };
}

export const SAMPLE_PGNS: Record<string, { title: string; desc: string; pgn: string }> = {
  saved: {
    title: "Gab's Analyzed Game",
    desc: "The original game from saved_pgn.pgn with full endgame checkmate and annotations",
    pgn: `[Event "Simple Game"]
[Site "GabChessGui"]
[White "White Player"]
[Black "Black Player"]
[Result "0-1"]

1. e2e4 {book best=e2e4=38} e7e5 {book best=e7e5=34} 2. g1f3 {book best=g1f3=48} b8c6 {book best=b8c6=33} 3. f1a6 {blunder best=f1b5=-369} b7b5 {miss best=b7a6=159} 4. a6b5 {best=157} f8d6 {excellent best=g8f6=135} 5. e1g1 {excellent best=c2c3=138} g8e7 {best=135} 6. d2d4 {good best=c2c3=92} e5d4 {best=114} 7. f3d4 {best=94} c6d4 {inaccuracy best=e8g8=180} 8. d1d4 {best=211} f7f6 {best=212} 9. f2f4 {best=193} e7c6 {best=218} 10. d4d5 a8b8 {best=183} 11. b1c3 {best=201} d8e7 {best=192} 12. b5c6 {good best=g1h1=143} d7c6 {best=128} 13. d5c6 {best=121} c8d7 {best=121} 14. c6c4 {excellent best=c6a6=129} e7f7 {best=146} 15. c4f7 {inaccuracy best=c4d3=78} e8f7 {best=104} 16. b2b3 {inaccuracy best=g1f2=47} d6c5 {best=56} 17. g1h1 {best=47} c5d4 {good best=d7c6=89} 18. f1f3 {excellent best=c1b2=77} h8d8 {best=59} 19. f3d3 {excellent best=c1d2=77} d7b5 {best=60} 20. d3d4 {brilliant=85} d8d4 {best=47} 21. c1e3 {best=100} d4d7 {best=34} 22. e3a7 {best=70} b8a8 {best=34} 23. a7e3 {best=47} b5c6 {best=43} 24. h1g1 {best=55} c6e4 {best=45} 25. c3e4 {best=51} d7e7 {best=45} 26. a2a4 {excellent best=e4f6=51} e7e4 {best=48} 27. g1f2 {best=51} a8e8 {best=67} 28. a1d1 {blunder best=a1e1=-568} e4e3 {great=-612} 29. d1d7 {best=-629} e8e7 {best=-673} 30. d7e7 {best=-700} e3e7 {best=-704} 31. a4a5 {good best=h2h4=-864} c7c5 {great=-949} 32. a5a6 {excellent best=g2g4=-914} e7e2 {blunder best=e7a7=2404} 33. f2e2 {great=2639} f7e6 {excellent best=f7g6=2477} 34. g2g4 {excellent best=a6a7=2813} e6d5 {excellent best=h7h5=2650} 35. a6a7 {best=3474} d5d4 {excellent best=d5e4=3369} 36. f4f5 {miss best=a7a8q=3163} d4c3 {excellent best=d4e5=2645} 37. h2h3 {miss best=a7a8q=2218} c3c2 {blunder best=g7g6=2981} 38. h3h4 {excellent best=a7a8q=3292} c2b3 {excellent best=c2c3=2551} 39. g4g5 {excellent best=a7a8q=3373} c5c4 {best=2896} 40. g5g6 {excellent best=a7a8q=3325} c4c3 {excellent best=h7g6=2382} 41. h4h5 {miss best=a7a8q=638} c3c2 {best=635} 42. g6h7 {miss best=a7a8q=1} c2c1q {great=1} 43. h5h6 {mistake best=a7a8q=-144} c1c7 {mistake best=c1c2=1} 44. e2e3 {blunder best=a7a8q=-3561} c7a7 {great=-3699} 45. e3e2 {excellent best=e3d3=-3835} a7d4 {miss best=a7a8=-188} 46. e2f1 {blunder best=h7h8q=M-14} d4f4 {great=M-14} 47. f1g2 {best=M-12} f4h6 {best=M-11} 48. h7h8q {excellent best=g2f3=M-10} h6h8 {best=M-10} 49. g2f3 {excellent best=g2g3=M-10} h8h2 {excellent best=h8h7=M-10} 50. f3e3 {best=M-7} h2e5 {excellent best=h2h4=M-8} 51. e3f3 {excellent best=e3f2=M-7} e5f5 {best=M-7} 52. f3g3 {excellent best=f3g2=M-6} f5e4 {excellent best=b3c3=M-6} 53. g3f2 {excellent best=g3h3=M-5} e4f4 {excellent best=e4g4=M-6} 54. f2g1 {excellent best=f2g2=M-6} f4f3 {best=M-5} 55. g1h2 {best=M-5} f6f5 {excellent best=f3g4=M-4} 56. h2g1 {best=M-4} f5f4 {best=M-3} 57. g1h2 {best=M-3} f3g4 {best=M-2} 58. h2h1 {best=M-2} f4f3 {best=M-1} 59. h1h2 {best=M-1} g4g2 {best=M0} 0-1`,
  },
  opera: {
    title: "The Opera Game (1858)",
    desc: "Paul Morphy's legendary attacking masterpiece with queen and rook sacrifices",
    pgn: `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.10.21"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  },
  immortal: {
    title: "Kasparov's Immortal (1999)",
    desc: "Garry Kasparov vs Veselin Topalov - One of the greatest chess games ever played",
    pgn: `[Event "Hoogovens Group A"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`,
  },
  century: {
    title: "Game of the Century (1956)",
    desc: "13-year-old Bobby Fischer dismantles Donald Byrne with a stunning queen sacrifice",
    pgn: `[Event "Third Rosenwald Trophy"]
[Site "New York, NY USA"]
[Date "1956.10.17"]
[White "Donald Byrne"]
[Black "Bobby Fischer"]
[Result "0-1"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1`,
  },
};
