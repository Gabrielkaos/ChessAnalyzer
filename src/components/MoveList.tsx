'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { MoveAnalysis, MoveClassification } from '@/types/chess';

interface MoveListProps {
  moves: MoveAnalysis[];
  currentPly: number; // 0 is start position, 1 is first move, etc.
  onSelectPly: (ply: number) => void;
  filterClassification?: MoveClassification | null;
}

export const MoveList: React.FC<MoveListProps> = ({
  moves,
  currentPly,
  onSelectPly,
  filterClassification,
}) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Group into pairs (white, black)
  const pairedMoves: { moveNumber: number; white?: MoveAnalysis; black?: MoveAnalysis }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairedMoves.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  const [autoScroll, setAutoScroll] = React.useState<boolean>(false);

  useEffect(() => {
    if (autoScroll && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPly, autoScroll]);

  return (
    <div className="w-full h-[280px] bg-[#1f1e1b] border border-[#363430] rounded-xl overflow-hidden flex flex-col shadow-inner select-none">
      {/* Header */}
      <div className="grid grid-cols-12 px-3 py-2 bg-[#262421] border-b border-[#363430] text-[11px] font-bold uppercase tracking-wider text-gray-400 items-center">
        <span className="col-span-2 text-center">#</span>
        <span className="col-span-4">White</span>
        <span className="col-span-4">Black</span>
        <div className="col-span-2 flex justify-end">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold border transition-colors ${
              autoScroll
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-[#1a1917] text-gray-500 border-[#363430] hover:text-gray-300'
            }`}
            title={autoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is OFF (Scroll is locked in place)'}
          >
            {autoScroll ? 'Scroll: ON' : 'Scroll: OFF'}
          </button>
        </div>
      </div>

      {/* Scrollable Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#262421]/60 text-xs">
        {/* Startpos button */}
        <div
          onClick={() => onSelectPly(0)}
          className={`px-3 py-1.5 cursor-pointer text-center text-xs font-semibold transition-colors ${
            currentPly === 0
              ? 'bg-[#3b3834] text-white'
              : 'text-gray-400 hover:bg-[#262421] hover:text-gray-200'
          }`}
        >
          Initial Position
        </div>

        {pairedMoves.map(({ moveNumber, white, black }) => {
          const isWhiteActive = white && currentPly === white.ply;
          const isBlackActive = black && currentPly === black.ply;

          const isWhiteMatched =
            !filterClassification || (white && white.classification === filterClassification);
          const isBlackMatched =
            !filterClassification || (black && black.classification === filterClassification);

          return (
            <div
              key={moveNumber}
              className={`grid grid-cols-12 items-center px-2 py-1 transition-colors ${
                moveNumber % 2 === 0 ? 'bg-[#1a1917]/40' : ''
              }`}
            >
              {/* Move Number */}
              <span className="col-span-2 text-center text-[11px] font-semibold text-gray-500">
                {moveNumber}.
              </span>

              {/* White Move */}
              <div className="col-span-5 pr-1">
                {white ? (
                  <button
                    ref={isWhiteActive ? activeRef : null}
                    onClick={() => onSelectPly(white.ply)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                      isWhiteActive
                        ? 'bg-[#363430] text-white font-bold ring-1 ring-amber-500/50'
                        : isWhiteMatched && filterClassification
                        ? 'bg-amber-500/10 text-amber-200 font-semibold'
                        : 'text-gray-300 hover:bg-[#2a2825]'
                    }`}
                  >
                    <span className="font-medium">{white.san}</span>
                    {white.classification && (
                      <div className="flex items-center gap-1">
                        <Image
                          src={`/badges/${white.classification}.png`}
                          alt={white.classification}
                          width={14}
                          height={14}
                          className="object-contain"
                        />
                      </div>
                    )}
                  </button>
                ) : null}
              </div>

              {/* Black Move */}
              <div className="col-span-5 pl-1">
                {black ? (
                  <button
                    ref={isBlackActive ? activeRef : null}
                    onClick={() => onSelectPly(black.ply)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                      isBlackActive
                        ? 'bg-[#363430] text-white font-bold ring-1 ring-amber-500/50'
                        : isBlackMatched && filterClassification
                        ? 'bg-amber-500/10 text-amber-200 font-semibold'
                        : 'text-gray-300 hover:bg-[#2a2825]'
                    }`}
                  >
                    <span className="font-medium">{black.san}</span>
                    {black.classification && (
                      <div className="flex items-center gap-1">
                        <Image
                          src={`/badges/${black.classification}.png`}
                          alt={black.classification}
                          width={14}
                          height={14}
                          className="object-contain"
                        />
                      </div>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
