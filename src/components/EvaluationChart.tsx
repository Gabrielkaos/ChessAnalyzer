'use client';

import React, { useMemo } from 'react';
import { MoveAnalysis } from '@/types/chess';

interface EvaluationChartProps {
  moves: MoveAnalysis[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export const EvaluationChart: React.FC<EvaluationChartProps> = ({
  moves,
  currentPly,
  onSelectPly,
}) => {
  const points = useMemo(() => {
    if (moves.length === 0) return [];

    // Start with 0 at ply 0
    const res = [{ ply: 0, score: 0.2, classification: 'book' }];

    for (const m of moves) {
      let pawns = m.score / 100;
      if (m.mate !== null) {
        pawns = m.mate > 0 ? 10 : -10;
      }
      // Clamp to -8 to +8 for visual readability
      pawns = Math.max(-8, Math.min(8, pawns));
      res.push({
        ply: m.ply,
        score: pawns,
        classification: m.classification,
      });
    }

    return res;
  }, [moves]);

  if (points.length <= 1) return null;

  const width = 600;
  const height = 90;
  const zeroY = height / 2;

  // Map score (-8 to +8) to Y (height-4 to 4)
  const getY = (score: number) => {
    const clamped = Math.max(-8, Math.min(8, score));
    return zeroY - (clamped / 8) * (height / 2 - 8);
  };

  const getX = (index: number) => {
    return (index / (points.length - 1)) * (width - 16) + 8;
  };

  // Build SVG path
  let pathD = `M ${getX(0)} ${getY(points[0].score)}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${getX(i)} ${getY(points[i].score)}`;
  }

  // Build White advantage area (above zero) & Black advantage area (below zero)
  let areaD = `M ${getX(0)} ${zeroY}`;
  for (let i = 0; i < points.length; i++) {
    areaD += ` L ${getX(i)} ${getY(points[i].score)}`;
  }
  areaD += ` L ${getX(points.length - 1)} ${zeroY} Z`;

  const activeIndex = Math.min(currentPly, points.length - 1);
  const activeX = getX(activeIndex);

  return (
    <div className="w-full bg-[#1f1e1b] border border-[#363430] rounded-xl p-3 shadow-md select-none">
      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 mb-1 px-1">
        <span>Game Momentum / Evaluation</span>
        <span className="text-[10px] text-gray-500">Click graph to jump to move</span>
      </div>

      <div className="relative w-full h-[80px] bg-[#161512] rounded-lg overflow-hidden border border-[#2a2825]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-pointer"
          preserveAspectRatio="none"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickRatio = (e.clientX - rect.left) / rect.width;
            const targetIndex = Math.round(clickRatio * (points.length - 1));
            onSelectPly(points[targetIndex].ply);
          }}
        >
          <defs>
            <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#81b64c" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Equality line */}
          <line
            x1="0"
            y1={zeroY}
            x2={width}
            y2={zeroY}
            stroke="#44423e"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Area fill */}
          <path d={areaD} fill="url(#evalGrad)" />

          {/* Advantage line */}
          <path
            d={pathD}
            fill="none"
            stroke="#96bc4b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Critical Move Markers */}
          {points.map((p, idx) => {
            if (p.classification === 'blunder') {
              return (
                <circle
                  key={idx}
                  cx={getX(idx)}
                  cy={getY(p.score)}
                  r="3.5"
                  fill="#ca3431"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              );
            }
            if (p.classification === 'brilliant') {
              return (
                <circle
                  key={idx}
                  cx={getX(idx)}
                  cy={getY(p.score)}
                  r="3.5"
                  fill="#26c2a3"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              );
            }
            return null;
          })}

          {/* Current Move Indicator Line */}
          <line
            x1={activeX}
            y1="0"
            x2={activeX}
            y2={height}
            stroke="#f0c15c"
            strokeWidth="2"
          />
          <circle cx={activeX} cy={getY(points[activeIndex].score)} r="4" fill="#f0c15c" />
        </svg>
      </div>
    </div>
  );
};
