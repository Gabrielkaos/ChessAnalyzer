'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import Image from 'next/image';
import { soundManager } from '@/lib/sounds';
import { MoveClassification } from '@/types/chess';

interface ChessboardProps {
  fen: string;
  orientation?: 'white' | 'black';
  lastMove?: { from: string; to: string; classification?: MoveClassification };
  bestMove?: { from: string; to: string };
  onMove?: (from: Square, to: Square, promotion?: string) => void;
  interactive?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PIECE_IMAGES: Record<string, string> = {
  wp: '/pieces/wp.png',
  wn: '/pieces/wN.png',
  wb: '/pieces/wB.png',
  wr: '/pieces/wR.png',
  wq: '/pieces/wQ.png',
  wk: '/pieces/wK.png',
  bp: '/pieces/bp.png',
  bn: '/pieces/bN.png',
  bb: '/pieces/bB.png',
  br: '/pieces/bR.png',
  bq: '/pieces/bQ.png',
  bk: '/pieces/bK.png',
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  brilliant: '#26c2a3',
  great: '#5b8baf',
  best: '#81b64c',
  excellent: '#96bc4b',
  good: '#96bc4b',
  book: '#d5a47d',
  inaccuracy: '#f0c15c',
  mistake: '#e58f2a',
  miss: '#ff5757',
  blunder: '#ca3431',
  legendary: '#a855f7',
};

export const Chessboard: React.FC<ChessboardProps> = ({
  fen,
  orientation = 'white',
  lastMove,
  bestMove,
  onMove,
  interactive = true,
}) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [chessInstance, setChessInstance] = useState<Chess>(new Chess(fen));

  useEffect(() => {
    try {
      setChessInstance(new Chess(fen));
      setSelectedSquare(null);
      setValidMoves([]);
    } catch {
      // ignore invalid fen
    }
  }, [fen]);

  const ranks = orientation === 'white' ? RANKS : [...RANKS].reverse();
  const files = orientation === 'white' ? FILES : [...FILES].reverse();

  // Find King in check
  let inCheckSquare: Square | null = null;
  if (chessInstance.inCheck()) {
    const turn = chessInstance.turn();
    const board = chessInstance.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && piece.type === 'k' && piece.color === turn) {
          inCheckSquare = piece.square;
        }
      }
    }
  }

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!interactive) return;

      if (selectedSquare) {
        if (selectedSquare === square) {
          setSelectedSquare(null);
          setValidMoves([]);
          return;
        }

        // Check if clicked square is a valid destination
        if (validMoves.includes(square)) {
          const piece = chessInstance.get(selectedSquare);
          const isPawnPromotion =
            piece?.type === 'p' &&
            ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1'));

          const promotion = isPawnPromotion ? 'q' : undefined;

          try {
            const moveResult = chessInstance.move({
              from: selectedSquare,
              to: square,
              promotion,
            });

            if (moveResult) {
              if (moveResult.captured) {
                soundManager.play('capture');
              } else if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
                soundManager.play('castle');
              } else {
                soundManager.play('move');
              }

              if (chessInstance.inCheck()) {
                soundManager.play('check');
              }

              onMove?.(selectedSquare, square, promotion);
            }
          } catch {}

          setSelectedSquare(null);
          setValidMoves([]);
          return;
        }
      }

      // Select new piece
      const piece = chessInstance.get(square);
      if (piece && piece.color === chessInstance.turn()) {
        setSelectedSquare(square);
        const legal = chessInstance.moves({ square, verbose: true });
        setValidMoves(legal.map((m) => m.to));
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    },
    [interactive, selectedSquare, validMoves, chessInstance, onMove]
  );

  // Calculate coordinates for SVG arrows
  const getSquareCenter = (sq: string) => {
    const file = sq[0];
    const rank = sq[1];
    const colIdx = files.indexOf(file);
    const rowIdx = ranks.indexOf(rank);
    return {
      x: colIdx * 12.5 + 6.25,
      y: rowIdx * 12.5 + 6.25,
    };
  };

  const arrowColor = lastMove?.classification
    ? CLASSIFICATION_COLORS[lastMove.classification] || '#81b64c'
    : '#81b64c';

  return (
    <div className="relative w-full aspect-square select-none max-w-[560px] mx-auto rounded-lg overflow-hidden shadow-2xl border-4 border-[#363430] bg-[#262421]">
      {/* 8x8 Grid */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((rank, rowIdx) =>
          files.map((file, colIdx) => {
            const square = `${file}${rank}` as Square;
            const isLight = (colIdx + rowIdx) % 2 === 0;
            const piece = chessInstance.get(square);
            const isSelected = selectedSquare === square;
            const isValidMove = validMoves.includes(square);
            const isLastMoveFrom = lastMove?.from === square;
            const isLastMoveTo = lastMove?.to === square;
            const isInCheck = inCheckSquare === square;

            let squareBg = isLight ? 'bg-board-light' : 'bg-board-dark';

            if (isSelected) {
              squareBg = 'bg-[#bbc759]';
            } else if (isLastMoveFrom || isLastMoveTo) {
              squareBg = isLight ? 'bg-[#f5f682]' : 'bg-[#b9ca43]';
            }

            return (
              <div
                key={square}
                onClick={() => handleSquareClick(square)}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${squareBg} ${
                  isInCheck ? 'ring-4 ring-rose-500 ring-inset animate-pulse' : ''
                }`}
              >
                {/* Board coordinates */}
                {colIdx === 0 && (
                  <span
                    className={`absolute top-0.5 left-1 text-[10px] font-bold pointer-events-none ${
                      isLight ? 'text-board-dark' : 'text-board-light'
                    }`}
                  >
                    {rank}
                  </span>
                )}
                {rowIdx === 7 && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[10px] font-bold pointer-events-none ${
                      isLight ? 'text-board-dark' : 'text-board-light'
                    }`}
                  >
                    {file}
                  </span>
                )}

                {/* Piece Image */}
                {piece && (
                  <div className="relative w-[82%] h-[82%] z-10 drop-shadow-md">
                    <Image
                      src={PIECE_IMAGES[`${piece.color}${piece.type}`]}
                      alt={`${piece.color} ${piece.type}`}
                      fill
                      sizes="(max-width: 768px) 12vw, 65px"
                      className="object-contain pointer-events-none select-none transition-transform hover:scale-105"
                      priority
                    />
                  </div>
                )}

                {/* Move dot / capture ring hint */}
                {isValidMove && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    {piece ? (
                      <div className="w-full h-full rounded-full border-4 border-black/25" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full bg-black/25" />
                    )}
                  </div>
                )}

                {/* Classification badge badge on destination square */}
                {isLastMoveTo && lastMove?.classification && (
                  <div className="absolute -top-2 -right-2 z-30 shadow-lg pointer-events-none">
                    <div className="w-6 h-6 rounded-full bg-surface border-2 border-surface flex items-center justify-center">
                      <Image
                        src={`/badges/${lastMove.classification}.png`}
                        alt={lastMove.classification}
                        width={20}
                        height={20}
                        className="object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SVG Overlay for Best Move & Played Move Arrows */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-25"
        viewBox="0 0 100 100"
      >
        <defs>
          <marker
            id="arrow-played"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill={arrowColor} fillOpacity="0.85" />
          </marker>

          <marker
            id="arrow-best"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#81b64c" fillOpacity="0.9" />
          </marker>
        </defs>

        {/* Best move suggestion arrow (if played move wasn't best) */}
        {bestMove &&
          bestMove.from &&
          bestMove.to &&
          (!lastMove || lastMove.from !== bestMove.from || lastMove.to !== bestMove.to) && (
            <line
              x1={`${getSquareCenter(bestMove.from).x}%`}
              y1={`${getSquareCenter(bestMove.from).y}%`}
              x2={`${getSquareCenter(bestMove.to).x}%`}
              y2={`${getSquareCenter(bestMove.to).y}%`}
              stroke="#81b64c"
              strokeWidth="2.2"
              strokeDasharray="3 2"
              strokeOpacity="0.9"
              markerEnd="url(#arrow-best)"
            />
          )}

        {/* Played move arrow */}
        {lastMove && lastMove.from && lastMove.to && (
          <line
            x1={`${getSquareCenter(lastMove.from).x}%`}
            y1={`${getSquareCenter(lastMove.from).y}%`}
            x2={`${getSquareCenter(lastMove.to).x}%`}
            y2={`${getSquareCenter(lastMove.to).y}%`}
            stroke={arrowColor}
            strokeWidth="2.4"
            strokeOpacity="0.8"
            markerEnd="url(#arrow-played)"
          />
        )}
      </svg>
    </div>
  );
};
