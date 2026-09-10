'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import confetti from 'canvas-confetti';
import { Chessboard } from '@/components/Chessboard';
import { EvaluationBar } from '@/components/EvaluationBar';
import { BoardControls } from '@/components/BoardControls';
import { GameReviewHeader } from '@/components/GameReviewHeader';
import { MoveCoachCard } from '@/components/MoveCoachCard';
import { MoveClassificationSummary } from '@/components/MoveClassificationSummary';
import { MoveList } from '@/components/MoveList';
import { EvaluationChart } from '@/components/EvaluationChart';
import { PgnInputModal } from '@/components/PgnInputModal';
import { EngineSelectModal } from '@/components/EngineSelectModal';
import { AnalysisProgressBar } from '@/components/AnalysisProgressBar';
import { SAMPLE_PGNS, calculateWinRate, calculateAccuracy, getHarmonicMean, calculateEstimatedElo, determineGamePhase, getMoveCommentary } from '@/lib/analyzer';
import { identifyOpening } from '@/lib/openings';
import { analyzeGame, ReviewProgress, loadGameFromPgn } from '@/lib/gameReviewer';
import { engineManager, EngineConfig } from '@/lib/engineManager';
import { soundManager } from '@/lib/sounds';
import { GameReview, MoveClassification, MoveAnalysis } from '@/types/chess';
import { Sparkles, Play, CheckCircle2, RotateCcw, Cpu, PlusCircle } from 'lucide-react';

export interface BoardMoveRecord {
  ply: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  from: Square;
  to: Square;
  captured?: string;
  promotion?: string;
  fenBefore: string;
  fenAfter: string;
}

export default function ChessAnalyzerApp() {
  const [currentPgn, setCurrentPgn] = useState<string>(SAMPLE_PGNS.saved.pgn);
  const [review, setReview] = useState<GameReview | null>(null);
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<ReviewProgress | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customExplorationFen, setCustomExplorationFen] = useState<string | null>(null);

  // Live interactive board mode states
  const [isFreePlay, setIsFreePlay] = useState<boolean>(false);
  const [boardMoves, setBoardMoves] = useState<BoardMoveRecord[]>([]);

  // Engine & evaluation state
  const [engineConfig, setEngineConfig] = useState<EngineConfig>({
    type: 'native',
    nativePath: '',
    nativeName: 'GOOB 2.2-BETA',
    customFileName: '',
    depth: 20,
  });
  const [liveEval, setLiveEval] = useState<{ score: number; mate: number | null; bestMove?: string } | null>(null);
  const [liveEngineEnabled, setLiveEngineEnabled] = useState<boolean>(false);
  const [filterClassification, setFilterClassification] = useState<MoveClassification | null>(null);

  // Auto-toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync engine configuration
  useEffect(() => {
    const cfg = engineManager.getConfig();
    setEngineConfig(cfg);
  }, []);

  // Initial load: parse default game
  const initialLoad = useCallback(async (pgnToLoad: string) => {
    try {
      const { chess, headers, rawAnnotations } = loadGameFromPgn(pgnToLoad);
      const history = chess.history({ verbose: true });
      const totalPlies = history.length;
      const uciMoves = history.map((m) => m.lan || `${m.from}${m.to}`);
      const openingInfo = identifyOpening(uciMoves);
      const longestBook = openingInfo.bookPlyCount;

      const hasPrecomputedEvals = Array.from(rawAnnotations.values()).some(
        (a) => a.eval !== undefined || a.mate !== undefined
      );

      // Centipawns array: position 0 to position totalPlies
      const centipawns: number[] = [20];
      const mates: (number | null)[] = [null];

      for (let i = 0; i < totalPlies; i++) {
        const anno = rawAnnotations.get(i);
        const evalCp = anno?.eval !== undefined ? anno.eval : (i === 0 ? 38 : 20);
        const mateVal = anno?.mate !== undefined ? anno.mate : null;
        centipawns.push(evalCp);
        mates.push(mateVal);
      }

      const centipawns_black = centipawns.map((cp) => -cp);
      const win_rate_lists = centipawns.map(calculateWinRate);
      const win_rate_lists_black = centipawns_black.map(calculateWinRate);

      const accuracy_lists: number[] = [];
      const accuracy_lists_black: number[] = [];

      for (let i = 0; i < win_rate_lists.length - 1; i++) {
        if (i % 2 === 0) {
          accuracy_lists.push(Math.max(calculateAccuracy(win_rate_lists[i], win_rate_lists[i + 1]), 10.0));
        } else {
          accuracy_lists_black.push(Math.max(calculateAccuracy(win_rate_lists_black[i], win_rate_lists_black[i + 1]), 10.0));
        }
      }

      // Book moves override
      for (let i = 0; i < longestBook; i++) {
        if (i % 2 === 0) {
          const wIdx = i / 2;
          if (wIdx < accuracy_lists.length) accuracy_lists[wIdx] = 100.0;
        } else {
          const bIdx = Math.floor(i / 2);
          if (bIdx < accuracy_lists_black.length) accuracy_lists_black[bIdx] = 100.0;
        }
      }

      const clipped_white = accuracy_lists.map((a) => Math.max(10.0, Math.min(500.0, a)));
      const clipped_black = accuracy_lists_black.map((a) => Math.max(10.0, Math.min(500.0, a)));

      const whiteAccuracy = hasPrecomputedEvals
        ? Math.round(Math.min(getHarmonicMean(clipped_white), 100.0) * 10) / 10
        : 0;
      const blackAccuracy = hasPrecomputedEvals
        ? Math.round(Math.min(getHarmonicMean(clipped_black), 100.0) * 10) / 10
        : 0;

      const whiteEstimatedElo = hasPrecomputedEvals ? calculateEstimatedElo(whiteAccuracy) : 1500;
      const blackEstimatedElo = hasPrecomputedEvals ? calculateEstimatedElo(blackAccuracy) : 1500;

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

      const moves: MoveAnalysis[] = history.map((m, idx) => {
        const anno = rawAnnotations.get(idx);
        const isWhite = m.color === 'w';
        const moveIdx = Math.floor(idx / 2);
        const rawAcc = isWhite ? accuracy_lists[moveIdx] : accuracy_lists_black[moveIdx];
        const moveAcc = Math.round((rawAcc ?? 100) * 10) / 10;
        const score = centipawns[idx + 1];
        const mate = mates[idx + 1];

        const classification: MoveClassification =
          anno?.classification || (idx < longestBook ? 'book' : 'best');

        if (isWhite) {
          whiteCounts[classification] = (whiteCounts[classification] || 0) + 1;
        } else {
          blackCounts[classification] = (blackCounts[classification] || 0) + 1;
        }

        let displayEval = '0.0';
        if (mate !== null) {
          displayEval = mate === 0 ? 'M0' : (mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`);
        } else {
          const pawns = (score / 100).toFixed(1);
          displayEval = score > 0 ? `+${pawns}` : pawns;
        }

        const bestMoveUci = anno?.best || (m.lan || `${m.from}${m.to}`);

        return {
          ply: idx + 1,
          moveNumber: Math.floor(idx / 2) + 1,
          color: m.color,
          san: m.san,
          uci: m.lan || `${m.from}${m.to}`,
          from: m.from,
          to: m.to,
          captured: m.captured,
          fenBefore: m.before,
          fenAfter: m.after,
          score,
          mate,
          displayEval,
          winRateBefore: isWhite ? Math.round(win_rate_lists[idx] * 10) / 10 : Math.round(win_rate_lists_black[idx] * 10) / 10,
          winRateAfter: isWhite ? Math.round(win_rate_lists[idx + 1] * 10) / 10 : Math.round(win_rate_lists_black[idx + 1] * 10) / 10,
          winRateLoss: Math.max(0, Math.round(((isWhite ? win_rate_lists[idx] : win_rate_lists_black[idx]) - (isWhite ? win_rate_lists[idx + 1] : win_rate_lists_black[idx + 1])) * 10) / 10),
          accuracy: moveAcc,
          classification,
          bestMoveUci,
          bestMoveSan: bestMoveUci,
          bestMoveScore: score,
          bestMoveMate: mate,
          pv: '',
          commentary: getMoveCommentary(classification, m.san, bestMoveUci, 'GOOB 2.2-BETA'),
          isSacrifice: false,
          gamePhase: determineGamePhase(m.before),
        };
      });

      const placeholderReview: GameReview = {
        headers,
        moves,
        whiteAccuracy,
        blackAccuracy,
        whitePhaseAccuracy: {
          opening: whiteAccuracy || 100,
          middlegame: whiteAccuracy || 100,
          endgame: whiteAccuracy || 100,
        },
        blackPhaseAccuracy: {
          opening: blackAccuracy || 100,
          middlegame: blackAccuracy || 100,
          endgame: blackAccuracy || 100,
        },
        whiteCounts,
        blackCounts,
        whiteEstimatedElo,
        blackEstimatedElo,
        openingName: openingInfo.name,
        openingEco: openingInfo.eco,
        analyzedDepth: engineConfig.depth || 20,
        totalMoves: Math.ceil(history.length / 2),
        result: headers.Result || '*',
        winner:
          headers.Result === '1-0'
            ? 'w'
            : headers.Result === '0-1'
            ? 'b'
            : headers.Result === '1/2-1/2'
            ? 'draw'
            : null,
      };

      setReview(placeholderReview);
      setCurrentPly(0);
      setCustomExplorationFen(null);
    } catch (e) {
      console.error('Initial load failed:', e);
    }
  }, [engineConfig.depth]);

  useEffect(() => {
    initialLoad(currentPgn);
  }, [initialLoad, currentPgn]);

  // Run full game review with chosen engine
  const handleStartReview = async (pgnString: string, depth?: number) => {
    const targetDepth = depth || engineConfig.depth || 20;
    setCurrentPgn(pgnString);
    setIsAnalyzing(true);
    setCustomExplorationFen(null);
    engineManager.stop();

    try {
      soundManager.play('gameStart');
      const analyzedReview = await analyzeGame(pgnString, targetDepth, (prog) => {
        setProgress(prog);
      });

      setReview(analyzedReview);
      setCurrentPly(analyzedReview.moves.length > 0 ? 1 : 0);
      showToast('Game Review Complete!');

      // Celebrate with confetti if brilliant move was found or game analyzed!
      const totalBrilliant =
        (analyzedReview.whiteCounts.brilliant || 0) + (analyzedReview.blackCounts.brilliant || 0);
      if (totalBrilliant > 0) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#26c2a3', '#81b64c', '#5b8baf'],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      showToast(msg);
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  // Play appropriate sound when navigating to a ply
  const playMoveSound = useCallback(
    (ply: number) => {
      if (ply <= 0) {
        soundManager.play('move');
        return;
      }
      if (isFreePlay) {
        const bm = boardMoves[ply - 1];
        if (!bm) {
          soundManager.play('move');
          return;
        }
        const isCapture = Boolean(bm.captured || bm.san.includes('x'));
        const isCastle = bm.san.includes('O-O');
        const isCheck = bm.san.includes('+') || bm.san.includes('#');

        if (isCastle) {
          soundManager.play('castle');
        } else if (isCapture) {
          soundManager.play('capture');
        } else {
          soundManager.play('move');
        }
        if (isCheck) {
          soundManager.play('check');
        }
        return;
      }

      if (!review) {
        soundManager.play('move');
        return;
      }
      const move = review.moves[ply - 1];
      if (!move) {
        soundManager.play('move');
        return;
      }
      if (move.classification === 'brilliant') {
        soundManager.play('brilliant');
        return;
      }

      const isCapture = Boolean(move.captured || move.san.includes('x'));
      const isCastle = move.san.includes('O-O');
      const isCheck = move.san.includes('+') || move.san.includes('#');

      if (isCastle) {
        soundManager.play('castle');
      } else if (isCapture) {
        soundManager.play('capture');
      } else {
        soundManager.play('move');
      }

      if (isCheck) {
        soundManager.play('check');
      }
    },
    [review, isFreePlay, boardMoves]
  );

  // Get current board position FEN
  const currentFen = useMemo(() => {
    if (isFreePlay) {
      if (currentPly === 0 || boardMoves.length === 0) {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      }
      const m = boardMoves[currentPly - 1];
      return m ? m.fenAfter : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    if (customExplorationFen) return customExplorationFen;
    if (!review || review.moves.length === 0 || currentPly === 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    const move = review.moves[currentPly - 1];
    return move ? move.fenAfter : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }, [isFreePlay, boardMoves, review, currentPly, customExplorationFen]);

  const currentMove = useMemo(() => {
    if (isFreePlay) {
      if (currentPly === 0 || boardMoves.length === 0) return null;
      const bm = boardMoves[currentPly - 1];
      if (!bm) return null;
      const displayScore = liveEval
        ? liveEval.mate !== null
          ? liveEval.mate > 0
            ? `M${liveEval.mate}`
            : `-M${Math.abs(liveEval.mate)}`
          : liveEval.score > 0
          ? `+${(liveEval.score / 100).toFixed(1)}`
          : `${(liveEval.score / 100).toFixed(1)}`
        : '0.0';
      return {
        ply: bm.ply,
        moveNumber: bm.moveNumber,
        color: bm.color,
        san: bm.san,
        uci: bm.uci,
        from: bm.from,
        to: bm.to,
        captured: bm.captured,
        fenBefore: bm.fenBefore,
        fenAfter: bm.fenAfter,
        score: liveEval?.score ?? 0,
        mate: liveEval?.mate ?? null,
        displayEval: displayScore,
        winRateBefore: 50,
        winRateAfter: 50,
        winRateLoss: 0,
        accuracy: 100,
        classification: 'good' as MoveClassification,
        bestMoveUci: liveEval?.bestMove || '',
        bestMoveSan: liveEval?.bestMove || '',
        bestMoveScore: liveEval?.score ?? 0,
        bestMoveMate: liveEval?.mate ?? null,
        pv: '',
        commentary: `Interactive Move (${bm.san}). Live evaluation: ${displayScore}. Engine suggested: ${liveEval?.bestMove || 'evaluating...'}. Click "Run Game Review" to review this game.`,
        isSacrifice: false,
        gamePhase: determineGamePhase(bm.fenBefore),
      } as MoveAnalysis;
    }
    if (!review || currentPly === 0) return null;
    return review.moves[currentPly - 1] || null;
  }, [isFreePlay, boardMoves, review, currentPly, liveEval]);

  // Previous move highlights & arrow
  const lastMove = useMemo(() => {
    if (isFreePlay) {
      if (currentPly === 0 || boardMoves.length === 0) return undefined;
      const m = boardMoves[currentPly - 1];
      return m ? { from: m.from, to: m.to } : undefined;
    }
    if (customExplorationFen || !currentMove) return undefined;
    return {
      from: currentMove.from,
      to: currentMove.to,
      classification: currentMove.classification,
    };
  }, [isFreePlay, boardMoves, currentPly, currentMove, customExplorationFen]);

  // Best move arrow
  const bestMove = useMemo(() => {
    if (liveEngineEnabled && liveEval?.bestMove && liveEval.bestMove.length >= 4) {
      return {
        from: liveEval.bestMove.slice(0, 2),
        to: liveEval.bestMove.slice(2, 4),
      };
    }
    if (customExplorationFen || !currentMove) return undefined;
    if (currentMove.bestMoveUci && currentMove.bestMoveUci.length >= 4) {
      return {
        from: currentMove.bestMoveUci.slice(0, 2),
        to: currentMove.bestMoveUci.slice(2, 4),
      };
    }
    return undefined;
  }, [currentMove, customExplorationFen, liveEngineEnabled, liveEval]);

  // Live evaluation effect when live engine is enabled, exploring, or free play
  useEffect(() => {
    if (isAnalyzing || (!liveEngineEnabled && !customExplorationFen && !isFreePlay)) {
      if (!isAnalyzing && !liveEngineEnabled) setLiveEval(null);
      return;
    }
    let isCancelled = false;

    engineManager.evaluatePosition(currentFen, engineConfig.depth || 20).then((res) => {
      if (!isCancelled) {
        setLiveEval({ score: res.score, mate: res.mate, bestMove: res.bestMove });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [currentFen, liveEngineEnabled, customExplorationFen, isFreePlay, engineConfig, isAnalyzing]);

  // Determine active score and mate for EvaluationBar
  const activeScore = useMemo(() => {
    if (isFreePlay || customExplorationFen) {
      return liveEval?.score ?? (currentMove?.score ?? 20);
    }
    if (liveEngineEnabled && liveEval) {
      return liveEval.score;
    }
    if (currentMove) {
      return currentMove.score;
    }
    return 20;
  }, [isFreePlay, customExplorationFen, liveEngineEnabled, liveEval, currentMove]);

  const activeMate = useMemo(() => {
    if (isFreePlay || customExplorationFen) {
      return liveEval?.mate ?? (currentMove?.mate ?? null);
    }
    if (liveEngineEnabled && liveEval) {
      return liveEval.mate;
    }
    if (currentMove) {
      return currentMove.mate;
    }
    return null;
  }, [isFreePlay, customExplorationFen, liveEngineEnabled, liveEval, currentMove]);

  // Start a fresh, detached interactive game
  const handleNewGame = () => {
    setIsFreePlay(true);
    setBoardMoves([]);
    setReview(null);
    setCurrentPly(0);
    setCustomExplorationFen(null);
    setLiveEngineEnabled(true);
    setOrientation('white');
    soundManager.play('gameStart');
    showToast('New Game started! Play moves on the board with live engine.');
  };

  // Handle user making a move directly on the chessboard
  const handleBoardMove = (from: Square, to: Square, promotion?: string) => {
    try {
      const chess = new Chess(currentFen);
      const res = chess.move({ from, to, promotion: promotion || 'q' });
      if (!res) return;

      const newFen = chess.fen();

      if (isFreePlay) {
        const baseMoves = boardMoves.slice(0, currentPly);
        const newRecord: BoardMoveRecord = {
          ply: baseMoves.length + 1,
          moveNumber: Math.floor(baseMoves.length / 2) + 1,
          color: res.color,
          san: res.san,
          uci: res.lan || `${res.from}${res.to}${res.promotion || ''}`,
          from: res.from as Square,
          to: res.to as Square,
          captured: res.captured,
          promotion: res.promotion,
          fenBefore: currentFen,
          fenAfter: newFen,
        };
        const nextMoves = [...baseMoves, newRecord];
        setBoardMoves(nextMoves);
        setCurrentPly(nextMoves.length);
        setCustomExplorationFen(null);
      } else {
        // Detach from loaded PGN and start live interactive line from current position!
        const baseMoves: BoardMoveRecord[] = [];
        if (review) {
          for (let i = 0; i < currentPly; i++) {
            const rm = review.moves[i];
            baseMoves.push({
              ply: rm.ply,
              moveNumber: rm.moveNumber,
              color: rm.color,
              san: rm.san,
              uci: rm.uci,
              from: rm.from as Square,
              to: rm.to as Square,
              captured: rm.captured,
              fenBefore: rm.fenBefore,
              fenAfter: rm.fenAfter,
            });
          }
        }
        const newRecord: BoardMoveRecord = {
          ply: baseMoves.length + 1,
          moveNumber: Math.floor(baseMoves.length / 2) + 1,
          color: res.color,
          san: res.san,
          uci: res.lan || `${res.from}${res.to}${res.promotion || ''}`,
          from: res.from as Square,
          to: res.to as Square,
          captured: res.captured,
          promotion: res.promotion,
          fenBefore: currentFen,
          fenAfter: newFen,
        };
        const nextMoves = [...baseMoves, newRecord];
        setBoardMoves(nextMoves);
        setCurrentPly(nextMoves.length);
        setIsFreePlay(true);
        setReview(null);
        setCustomExplorationFen(null);
        setLiveEngineEnabled(true);
        showToast('Detached from loaded PGN. Interactive live board mode active!');
      }
    } catch {}
  };

  // Run Game Review on either the active board moves or the current PGN
  const handleRunReviewClick = () => {
    if (isFreePlay || !review) {
      if (boardMoves.length === 0) {
        showToast('Please play some moves on the board first, or load a PGN!');
        return;
      }
      const chess = new Chess();
      for (const m of boardMoves) {
        chess.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      }
      const livePgn = chess.pgn();
      setIsFreePlay(false);
      handleStartReview(livePgn, engineConfig.depth || 20);
    } else {
      handleStartReview(currentPgn, engineConfig.depth || 20);
    }
  };

  // Display moves for MoveList
  const displayMoves: MoveAnalysis[] = useMemo(() => {
    if (isFreePlay) {
      return boardMoves.map((bm) => ({
        ply: bm.ply,
        moveNumber: bm.moveNumber,
        color: bm.color,
        san: bm.san,
        uci: bm.uci,
        from: bm.from,
        to: bm.to,
        captured: bm.captured,
        fenBefore: bm.fenBefore,
        fenAfter: bm.fenAfter,
        score: 0,
        mate: null,
        displayEval: '',
        winRateBefore: 50,
        winRateAfter: 50,
        winRateLoss: 0,
        accuracy: 100,
        classification: 'good' as MoveClassification,
        bestMoveUci: '',
        bestMoveSan: '',
        bestMoveScore: 0,
        bestMoveMate: null,
        pv: '',
        commentary: '',
        isSacrifice: false,
        gamePhase: determineGamePhase(bm.fenBefore),
      }));
    }
    return review?.moves || [];
  }, [isFreePlay, boardMoves, review]);

  const handleExportPgn = () => {
    if (!review) return;
    // Format annotated PGN with comments
    let annotated = `[Event "${review.headers.Event || 'Review'}"]\n[White "${review.headers.White || 'White'}"]\n[Black "${review.headers.Black || 'Black'}"]\n[Result "${review.result}"]\n\n`;

    review.moves.forEach((m, idx) => {
      if (idx % 2 === 0) {
        annotated += `${Math.floor(idx / 2) + 1}. `;
      }
      annotated += `${m.san} {${m.classification} best=${m.bestMoveSan || m.bestMoveUci}} `;
    });

    navigator.clipboard.writeText(annotated.trim()).then(() => {
      showToast('Annotated PGN copied to clipboard!');
    });
  };

  return (
    <div className="min-h-screen bg-[#161512] text-gray-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="w-full bg-[#1f1e1b] border-b border-[#2d2b27] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-white text-lg shadow-md shadow-emerald-950/50">
            ♟
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wide text-gray-100">
              Chess Analyzer <span className="text-emerald-400 font-bold text-xs uppercase px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">Game Review</span>
            </h1>
            <p className="text-[11px] text-gray-400">UCI Engine Accuracy & Move Classification</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Active Engine Selector Button */}
          <button
            onClick={() => setIsEngineModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2825] hover:bg-[#363430] border border-[#3b3834] rounded-xl text-xs font-semibold text-gray-200 transition-colors shadow-sm"
            title="Click to select local UCI engine (e.g. GOOB 2.2-BETA, Stockfish, or custom binary)"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-gray-400 hidden sm:inline">Engine:</span>
            <span className="font-bold text-amber-300">
              {engineConfig.type === 'native'
                ? engineConfig.nativeName || 'Local Native UCI'
                : engineConfig.type === 'custom-file'
                ? engineConfig.customFileName || 'Custom File'
                : 'Stockfish 10 (WASM)'}
            </span>
          </button>

          {/* New Game / Free Play Button */}
          <button
            onClick={handleNewGame}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2825] hover:bg-[#363430] border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Start a fresh game to play your own moves with live analysis"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="text-gray-200">New Game</span>
          </button>

          {customExplorationFen && (
            <button
              onClick={() => setCustomExplorationFen(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Back to Game
            </button>
          )}

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2825] hover:bg-[#363430] border border-[#3b3834] rounded-xl text-xs font-semibold text-gray-200 transition-colors"
          >
            Import / Load PGN
          </button>

          <button
            onClick={handleRunReviewClick}
            disabled={isAnalyzing || (isFreePlay && boardMoves.length === 0)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 transition-all hover:scale-105"
            title={isFreePlay ? 'Run Game Review on the moves played on the board' : 'Run Game Review on active game'}
          >
            <Sparkles className="w-4 h-4 fill-white" />
            {isAnalyzing ? 'Analyzing...' : 'Run Game Review'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Board, Eval Bar, Controls, Momentum Chart */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-stretch gap-3 justify-center">
            {/* Vertical Evaluation Bar */}
            <div className="w-8 shrink-0 flex flex-col self-stretch">
              <EvaluationBar
                score={activeScore}
                mate={activeMate}
                orientation={orientation}
              />
            </div>

            {/* Chessboard */}
            <div className="flex-1 max-w-[560px] aspect-square">
              <Chessboard
                fen={currentFen}
                orientation={orientation}
                lastMove={lastMove}
                bestMove={bestMove}
                onMove={handleBoardMove}
                interactive={true}
              />
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="max-w-[595px] w-full mx-auto">
            <BoardControls
              currentPly={currentPly}
              maxPly={isFreePlay ? boardMoves.length : (review?.moves.length || 0)}
              onNewGame={handleNewGame}
              onFirst={() => {
                setCustomExplorationFen(null);
                setCurrentPly(0);
                soundManager.play('move');
              }}
              onPrev={() => {
                setCustomExplorationFen(null);
                if (currentPly > 0) {
                  const target = currentPly - 1;
                  setCurrentPly(target);
                  soundManager.play('move');
                }
              }}
              onNext={() => {
                setCustomExplorationFen(null);
                const max = isFreePlay ? boardMoves.length : (review?.moves.length || 0);
                if (currentPly < max) {
                  const target = currentPly + 1;
                  setCurrentPly(target);
                  playMoveSound(target);
                }
              }}
              onLast={() => {
                setCustomExplorationFen(null);
                const max = isFreePlay ? boardMoves.length : (review?.moves.length || 0);
                if (max > 0) {
                  setCurrentPly(max);
                  playMoveSound(max);
                }
              }}
              onFlip={() => setOrientation(orientation === 'white' ? 'black' : 'white')}
              onOpenModal={() => setIsModalOpen(true)}
              onExportPgn={handleExportPgn}
              liveEngineEnabled={liveEngineEnabled}
              onToggleLiveEngine={() => {
                const next = !liveEngineEnabled;
                setLiveEngineEnabled(next);
                if (!next) setLiveEval(null);
              }}
            />
          </div>

          {/* Evaluation & Momentum Advantage Graph (Only when Game Review is active) */}
          {!isFreePlay && review && review.moves.length > 0 && (
            <div className="max-w-[595px] w-full mx-auto">
              <EvaluationChart
                moves={review.moves}
                currentPly={currentPly}
                onSelectPly={(ply) => {
                  setCustomExplorationFen(null);
                  setCurrentPly(ply);
                  playMoveSound(ply);
                }}
              />
            </div>
          )}
        </div>

        {/* Right Column: Game Review Card, Coach commentary, Summary Table, Move List */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Analysis Progress Banner */}
          {isAnalyzing && (
            <AnalysisProgressBar
              progress={progress}
              onCancel={() => {
                engineManager.stop();
                setIsAnalyzing(false);
                setProgress(null);
              }}
              engineName={
                engineConfig.type === 'native'
                  ? engineConfig.nativeName || 'GOOB 2.2-BETA'
                  : engineConfig.type === 'custom-file'
                  ? engineConfig.customFileName || 'Custom File'
                  : 'Stockfish 10'
              }
              depth={engineConfig.depth || 20}
            />
          )}

          {/* Live Board Mode Card when in isFreePlay */}
          {isFreePlay && (
            <div className="w-full bg-[#262421] border border-emerald-500/40 rounded-xl p-4 shadow-xl select-none">
              <div className="flex items-center justify-between mb-3 border-b border-[#363430] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    Live Board (Interactive)
                  </span>
                </div>
                <div className="text-[11px] text-amber-300 font-bold px-2 py-0.5 bg-amber-950/40 border border-amber-800/40 rounded">
                  {engineConfig.nativeName || 'GOOB 2.2-BETA'} (D{engineConfig.depth || 20})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-[#1f1e1b] border border-[#363430] rounded-lg p-2.5">
                  <div className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Live Evaluation</div>
                  <div className="text-base font-black text-gray-100">
                    {liveEval
                      ? liveEval.mate !== null
                        ? liveEval.mate > 0
                          ? `M${liveEval.mate}`
                          : `-M${Math.abs(liveEval.mate)}`
                        : Math.abs(liveEval.score) < 5
                        ? '0.0'
                        : liveEval.score > 0
                        ? `+${(liveEval.score / 100).toFixed(1)}`
                        : `${(liveEval.score / 100).toFixed(1)}`
                      : '0.0'}
                  </div>
                </div>

                <div className="bg-[#1f1e1b] border border-[#363430] rounded-lg p-2.5">
                  <div className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Engine Best Move</div>
                  <div className="text-base font-black text-emerald-400">
                    {liveEval?.bestMove || (liveEngineEnabled ? 'Calculating...' : 'Enable Live Engine')}
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-300 mb-3 flex items-center justify-between">
                <span>
                  Moves played: <strong className="text-white">{boardMoves.length}</strong>
                </span>
                <span className="text-gray-400">
                  Turn: <strong className="text-white">{currentFen.split(' ')[1] === 'w' ? 'White' : 'Black'}</strong>
                </span>
              </div>

              <button
                onClick={handleRunReviewClick}
                disabled={boardMoves.length === 0 || isAnalyzing}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-4 h-4 fill-white" />
                <span>{isAnalyzing ? 'Analyzing...' : 'Run Game Review on These Moves'}</span>
              </button>
            </div>
          )}

          {/* Review Header Card */}
          {!isFreePlay && review && (
            <GameReviewHeader
              review={review}
              onSelectPhase={(phase) => {
                const targetMove = review.moves.find((m) => m.gamePhase === phase);
                if (targetMove) {
                  setCurrentPly(targetMove.ply);
                  playMoveSound(targetMove.ply);
                }
              }}
            />
          )}

          {/* Move Coach Card */}
          <MoveCoachCard
            move={currentMove}
            engineName={
              review?.engineName ||
              (engineConfig.type === 'native'
                ? engineConfig.nativeName || 'GOOB 2.2-BETA'
                : engineConfig.type === 'custom-file'
                ? engineConfig.customFileName || 'Custom File'
                : 'Stockfish 10')
            }
          />

          {/* Classification Breakdown Table */}
          {!isFreePlay && review && (
            <MoveClassificationSummary
              review={review}
              selectedClassification={filterClassification}
              onSelectClassification={(classification) => setFilterClassification(classification)}
            />
          )}

          {/* Move-by-Move List Table */}
          {displayMoves.length > 0 && (
            <MoveList
              moves={displayMoves}
              currentPly={currentPly}
              onSelectPly={(ply) => {
                setCustomExplorationFen(null);
                setCurrentPly(ply);
                playMoveSound(ply);
              }}
              filterClassification={filterClassification}
            />
          )}
        </div>
      </main>

      {/* PGN Import Modal */}
      <PgnInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStartReview={handleStartReview}
        isAnalyzing={isAnalyzing}
      />

      {/* Engine Selection Modal */}
      <EngineSelectModal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        onEngineChanged={(newConfig) => {
          setEngineConfig(newConfig);
          showToast(
            `Engine switched to: ${
              newConfig.type === 'native'
                ? newConfig.nativeName
                : newConfig.type === 'custom-file'
                ? newConfig.customFileName
                : 'Stockfish 10 (WASM)'
            }`
          );
        }}
      />

      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#262421] border border-emerald-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
