export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'
  | 'legendary';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export interface MoveAnalysis {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  from: string;
  to: string;
  captured?: string;
  promotion?: string;
  fenBefore: string;
  fenAfter: string;
  score: number; // centipawns from White's perspective (+ = White advantage)
  mate: number | null; // Mate in X from White's perspective
  displayEval: string;
  winRateBefore: number;
  winRateAfter: number;
  winRateLoss: number;
  accuracy: number;
  classification: MoveClassification;
  bestMoveUci: string;
  bestMoveSan: string;
  bestMoveScore: number;
  bestMoveMate: number | null;
  pv: string;
  commentary: string;
  isSacrifice: boolean;
  gamePhase: GamePhase;
}

export interface PhaseAccuracy {
  opening: number;
  middlegame: number;
  endgame: number;
}

export interface GameReview {
  headers: Record<string, string>;
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  whitePhaseAccuracy: PhaseAccuracy;
  blackPhaseAccuracy: PhaseAccuracy;
  whiteCounts: Record<MoveClassification, number>;
  blackCounts: Record<MoveClassification, number>;
  whiteEstimatedElo: number;
  blackEstimatedElo: number;
  openingName: string;
  openingEco: string;
  analyzedDepth: number;
  engineName?: string;
  totalMoves: number;
  result: string;
  winner: 'w' | 'b' | 'draw' | null;
}

export interface EngineEvaluation {
  score: number; // Centipawns from position side-to-move or white
  mate: number | null;
  bestMove: string; // UCI e.g. "e2e4"
  depth: number;
  seldepth?: number;
  nodes?: number;
  pv?: string;
}
