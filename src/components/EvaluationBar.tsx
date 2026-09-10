'use client';

import React from 'react';

interface EvaluationBarProps {
  score: number; // Centipawns from White's perspective
  mate: number | null; // Mate in X from White's perspective
  orientation?: 'white' | 'black';
}

export const EvaluationBar: React.FC<EvaluationBarProps> = ({
  score,
  mate,
  orientation = 'white',
}) => {
  let whitePercent = 50;
  let displayText = '0.0';

  if (mate !== null) {
    if (mate === 0) {
      if (score >= 0) {
        whitePercent = 99;
        displayText = '1-0';
      } else {
        whitePercent = 1;
        displayText = '0-1';
      }
    } else if (mate > 0) {
      whitePercent = 97;
      displayText = `M${mate}`;
    } else {
      whitePercent = 3;
      displayText = `-M${Math.abs(mate)}`;
    }
  } else {
    const pawns = score / 100;
    if (Math.abs(score) < 5) {
      displayText = '0.0';
    } else {
      displayText = pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
    }

    // Exact sigmoid mapping from Game.py line 330:
    // win_prob = 0.5 + 0.5 * (2 / (1 + math.exp(-0.00368208 * eval)) - 1)
    let winRate = 50;
    try {
      const expVal = Math.exp(-0.00368208 * score);
      if (!isFinite(expVal)) {
        winRate = score > 0 ? 100 : 0;
      } else {
        winRate = 50 + 50 * (2 / (1 + expVal) - 1);
      }
    } catch {
      winRate = score > 0 ? 100 : 0;
    }
    whitePercent = Math.max(3, Math.min(97, winRate));
  }

  // Determine top and bottom percentages based on orientation
  const isWhiteOrientation = orientation === 'white';
  const topPercent = isWhiteOrientation ? 100 - whitePercent : whitePercent;
  const bottomPercent = 100 - topPercent;

  const isTopBlack = isWhiteOrientation;
  const isBottomWhite = isWhiteOrientation;

  const isTopWinning = isWhiteOrientation ? whitePercent < 50 : whitePercent > 50;
  const isBottomWinning = !isTopWinning;

  return (
    <div
      className="relative w-6 sm:w-8 h-full max-h-[560px] min-h-0 bg-[#262421] rounded-md sm:rounded-lg overflow-hidden border border-[#3b3834] flex flex-col shadow-inner select-none transition-all duration-300"
      title={`Evaluation: ${displayText} (${whitePercent.toFixed(1)}% White)`}
    >
      {/* Top section */}
      <div
        className={`w-full ${
          isTopBlack ? 'bg-[#1b1917]' : 'bg-[#ededed]'
        } transition-all duration-300 ease-out relative flex items-start justify-center pt-1 sm:pt-1.5`}
        style={{
          height: `${topPercent}%`,
          flex: `${Math.max(topPercent, 1)} 1 0%`,
        }}
      >
        {isTopWinning && (
          <span
            className={`text-[8px] sm:text-[10px] font-black tracking-tighter ${
              isTopBlack ? 'text-gray-200' : 'text-gray-900'
            }`}
          >
            {displayText}
          </span>
        )}
      </div>

      {/* Bottom section */}
      <div
        className={`w-full ${
          isBottomWhite ? 'bg-[#ededed]' : 'bg-[#1b1917]'
        } transition-all duration-300 ease-out relative flex items-end justify-center pb-1 sm:pb-1.5`}
        style={{
          height: `${bottomPercent}%`,
          flex: `${Math.max(bottomPercent, 1)} 1 0%`,
        }}
      >
        {isBottomWinning && (
          <span
            className={`text-[8px] sm:text-[10px] font-black tracking-tighter ${
              isBottomWhite ? 'text-gray-900' : 'text-gray-200'
            }`}
          >
            {displayText}
          </span>
        )}
      </div>
    </div>
  );
};

