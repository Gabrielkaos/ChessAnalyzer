'use client';

import React from 'react';
import { ReviewProgress } from '@/lib/gameReviewer';
import { Loader2, Square, Sparkles } from 'lucide-react';

interface AnalysisProgressBarProps {
  progress: ReviewProgress | null;
  onCancel: () => void;
  engineName?: string;
  depth?: number;
}

export const AnalysisProgressBar: React.FC<AnalysisProgressBarProps> = ({
  progress,
  onCancel,
  engineName = 'UCI Engine',
  depth = 20,
}) => {
  if (!progress) return null;

  return (
    <div className="w-full bg-[#262421] border border-amber-500/40 rounded-xl p-4 shadow-xl select-none animate-pulse-glow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="text-xs font-bold text-gray-100">
            {engineName} Review in Progress (Depth {depth})
          </span>
        </div>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition-colors"
        >
          <Square className="w-3 h-3 fill-current" />
          Stop
        </button>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full h-2.5 bg-[#181715] rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-400 transition-all duration-200"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
        <span className="truncate max-w-[300px]">{progress.statusText}</span>
        <span className="font-mono font-bold text-amber-400">{progress.percent}%</span>
      </div>

      {/* Higher depth explanation note */}
      <div className="pt-2 border-t border-[#363430] flex items-center gap-1.5 text-[10px] text-amber-300/90 font-medium">
        <Sparkles className="w-3 h-3 shrink-0 text-amber-400" />
        <span>Higher depth = More accurate analysis (calculates deeper tactical variations)</span>
      </div>
    </div>
  );
};
