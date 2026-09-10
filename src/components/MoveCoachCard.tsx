'use client';

import React from 'react';
import Image from 'next/image';
import { MoveAnalysis } from '@/types/chess';
import { Lightbulb, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

interface MoveCoachCardProps {
  move: MoveAnalysis | null;
  engineName?: string;
}

export const MoveCoachCard: React.FC<MoveCoachCardProps> = ({ move, engineName = 'Engine' }) => {
  if (!move) {
    return (
      <div className="w-full bg-[#262421] border border-[#363430] rounded-xl p-4 shadow-lg text-center text-gray-400 select-none">
        <Lightbulb className="w-6 h-6 mx-auto mb-2 text-amber-400/60" />
        <p className="text-xs">Select any move in the game to view {engineName} analysis and coach commentary.</p>
      </div>
    );
  }

  const isWhite = move.color === 'w';
  const prefix = isWhite ? `${move.moveNumber}.` : `${move.moveNumber}...`;

  return (
    <div className="w-full bg-[#262421] border border-[#363430] rounded-xl p-4 shadow-lg select-none">
      {/* Header with Classification Badge */}
      <div className="flex items-center justify-between gap-3 border-b border-[#363430] pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <Image
            src={`/badges/${move.classification}.png`}
            alt={move.classification}
            width={28}
            height={28}
            className="object-contain"
          />
          <div>
            <div className="text-sm font-black text-gray-100 uppercase tracking-wide flex items-center gap-2">
              <span className="capitalize">{move.classification}</span>
              <span className="text-xs font-normal text-gray-400">
                ({prefix} {move.san})
              </span>
            </div>
            <div className="text-[11px] text-gray-400">
              Evaluation: <span className="font-semibold text-gray-200">{move.displayEval}</span>
            </div>
          </div>
        </div>

        {/* Move Accuracy Gauge */}
        <div className="text-right">
          <span className="text-sm font-black text-gray-100">{move.accuracy}%</span>
          <div className="text-[10px] text-gray-400">Move Accuracy</div>
        </div>
      </div>

      {/* Commentary text */}
      <p className="text-xs text-gray-300 leading-relaxed mb-3">
        {move.commentary}
      </p>

      {/* Best Move comparison box if played move was not best */}
      {move.bestMoveSan && move.bestMoveSan !== move.san && move.classification !== 'book' && (
        <div className="bg-[#1f1e1b] border border-[#363430] rounded-lg p-2.5 flex items-center justify-between text-xs mb-3">
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-emerald-400 font-bold">Engine Best:</span>
            <span className="text-gray-100 font-bold px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-800/40 rounded">
              {move.bestMoveSan}
            </span>
          </div>
          {move.pv && (
            <span className="text-[11px] text-gray-500 truncate max-w-[180px]" title={move.pv}>
              Line: {move.pv}
            </span>
          )}
        </div>
      )}

      {/* Win rate change */}
      <div className="flex items-center justify-between pt-2 border-t border-[#363430] text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          {move.winRateLoss > 0 ? (
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          )}
          Win Rate: {move.winRateBefore}% → {move.winRateAfter}%
        </span>
        {move.winRateLoss > 0 && (
          <span className="font-semibold text-rose-400">-{move.winRateLoss}%</span>
        )}
      </div>
    </div>
  );
};
