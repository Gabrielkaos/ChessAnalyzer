'use client';

import React from 'react';
import { GameReview } from '@/types/chess';
import { Trophy, Award, Zap, ShieldAlert } from 'lucide-react';

interface GameReviewHeaderProps {
  review: GameReview;
  onSelectPhase?: (phase: 'opening' | 'middlegame' | 'endgame') => void;
}

export const GameReviewHeader: React.FC<GameReviewHeaderProps> = ({
  review,
  onSelectPhase,
}) => {
  const whiteName = review.headers.White || 'White';
  const blackName = review.headers.Black || 'Black';
  const whiteElo = review.headers.WhiteElo || '';
  const blackElo = review.headers.BlackElo || '';

  const getAccuracyColor = (acc: number) => {
    if (acc >= 90) return 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10';
    if (acc >= 80) return 'text-green-400 border-green-500/50 bg-green-500/10';
    if (acc >= 70) return 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10';
    return 'text-rose-400 border-rose-500/50 bg-rose-500/10';
  };

  return (
    <div className="w-full bg-[#262421] border border-[#363430] rounded-xl p-4 shadow-xl select-none">
      {/* Opening & Event Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#363430] pb-3 mb-4 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            {review.openingEco || 'ECO'}
          </span>
          <span className="font-medium text-gray-200">{review.openingName}</span>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          <span>{review.headers.Event || 'Game Review'}</span>
          <span>•</span>
          <span>{review.totalMoves} moves</span>
          <span>•</span>
          <span className="text-amber-300 font-bold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
            {review.engineName || 'UCI Engine'} (D{review.analyzedDepth})
          </span>
          <span>•</span>
          <span className="font-bold text-gray-200">{review.result}</span>
        </div>
      </div>

      {/* Players & Overall Accuracy Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* White Player Card */}
        <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl bg-[#1f1e1b] border border-[#363430] min-w-0 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-white text-black font-black flex items-center justify-center shadow text-xs sm:text-sm">
              W
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-gray-100 truncate">
                <span className="truncate">{whiteName}</span>
                {review.winner === 'w' && <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate">
                {whiteElo && <span className="truncate">Rating: {whiteElo}</span>}
                <span className="text-emerald-400 font-medium truncate">Est. {review.whiteEstimatedElo} Elo</span>
              </div>
            </div>
          </div>

          <div
            className={`shrink-0 flex flex-col items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-black ${getAccuracyColor(
              review.whiteAccuracy
            )}`}
          >
            <span className="text-base sm:text-lg leading-none font-black">{review.whiteAccuracy}%</span>
            <span className="text-[9px] sm:text-[10px] font-normal uppercase tracking-wider text-gray-300">Accuracy</span>
          </div>
        </div>

        {/* Black Player Card */}
        <div className="flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl bg-[#1f1e1b] border border-[#363430] min-w-0 overflow-hidden shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
            <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-neutral-900 border border-neutral-700 text-white font-black flex items-center justify-center shadow text-xs sm:text-sm">
              B
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-gray-100 truncate">
                <span className="truncate">{blackName}</span>
                {review.winner === 'b' && <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate">
                {blackElo && <span className="truncate">Rating: {blackElo}</span>}
                <span className="text-emerald-400 font-medium truncate">Est. {review.blackEstimatedElo} Elo</span>
              </div>
            </div>
          </div>

          <div
            className={`shrink-0 flex flex-col items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border font-black ${getAccuracyColor(
              review.blackAccuracy
            )}`}
          >
            <span className="text-base sm:text-lg leading-none font-black">{review.blackAccuracy}%</span>
            <span className="text-[9px] sm:text-[10px] font-normal uppercase tracking-wider text-gray-300">Accuracy</span>
          </div>
        </div>
      </div>

      {/* Phase Accuracy Comparison */}
      <div className="mt-4 pt-3 border-t border-[#363430]">
        <div className="text-[11px] font-semibold uppercase text-gray-400 mb-2 tracking-wider flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Performance by Game Phase</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Opening */}
          <div
            onClick={() => onSelectPhase?.('opening')}
            className="bg-[#1f1e1b] p-2 rounded-lg border border-[#363430] hover:border-[#4d4a45] cursor-pointer transition-colors text-xs"
          >
            <div className="text-gray-400 font-medium mb-1 flex justify-between">
              <span>Opening</span>
              <span className="text-[10px] text-gray-500">M1-10</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-200">{review.whitePhaseAccuracy.opening}%</span>
              <span className="text-gray-500">vs</span>
              <span className="text-gray-300">{review.blackPhaseAccuracy.opening}%</span>
            </div>
          </div>

          {/* Middlegame */}
          <div
            onClick={() => onSelectPhase?.('middlegame')}
            className="bg-[#1f1e1b] p-2 rounded-lg border border-[#363430] hover:border-[#4d4a45] cursor-pointer transition-colors text-xs"
          >
            <div className="text-gray-400 font-medium mb-1 flex justify-between">
              <span>Middlegame</span>
              <span className="text-[10px] text-gray-500">M11-30</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-200">{review.whitePhaseAccuracy.middlegame}%</span>
              <span className="text-gray-500">vs</span>
              <span className="text-gray-300">{review.blackPhaseAccuracy.middlegame}%</span>
            </div>
          </div>

          {/* Endgame */}
          <div
            onClick={() => onSelectPhase?.('endgame')}
            className="bg-[#1f1e1b] p-2 rounded-lg border border-[#363430] hover:border-[#4d4a45] cursor-pointer transition-colors text-xs"
          >
            <div className="text-gray-400 font-medium mb-1 flex justify-between">
              <span>Endgame</span>
              <span className="text-[10px] text-gray-500">30+</span>
            </div>
            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-200">{review.whitePhaseAccuracy.endgame}%</span>
              <span className="text-gray-500">vs</span>
              <span className="text-gray-300">{review.blackPhaseAccuracy.endgame}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
