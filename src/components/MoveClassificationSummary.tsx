'use client';

import React from 'react';
import Image from 'next/image';
import { GameReview, MoveClassification } from '@/types/chess';

interface MoveClassificationSummaryProps {
  review: GameReview;
  selectedClassification?: MoveClassification | null;
  onSelectClassification?: (classification: MoveClassification | null) => void;
}

const CATEGORIES: { key: MoveClassification; label: string; icon: string }[] = [
  { key: 'brilliant', label: 'Brilliant', icon: '/badges/brilliant.png' },
  { key: 'great', label: 'Great', icon: '/badges/great.png' },
  { key: 'best', label: 'Best', icon: '/badges/best.png' },
  { key: 'excellent', label: 'Excellent', icon: '/badges/excellent.png' },
  { key: 'good', label: 'Good', icon: '/badges/good.png' },
  { key: 'book', label: 'Book', icon: '/badges/book.png' },
  { key: 'inaccuracy', label: 'Inaccuracies', icon: '/badges/inaccuracy.png' },
  { key: 'mistake', label: 'Mistakes', icon: '/badges/mistake.png' },
  { key: 'miss', label: 'Misses', icon: '/badges/miss.png' },
  { key: 'blunder', label: 'Blunders', icon: '/badges/blunder.png' },
];

export const MoveClassificationSummary: React.FC<MoveClassificationSummaryProps> = ({
  review,
  selectedClassification,
  onSelectClassification,
}) => {
  return (
    <div className="w-full bg-[#262421] border border-[#363430] rounded-xl p-3 shadow-lg select-none">
      <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-[#363430] text-[11px] font-bold uppercase tracking-wider text-gray-400">
        <span className="w-10 text-center">White</span>
        <span>Move Classification</span>
        <span className="w-10 text-center">Black</span>
      </div>

      <div className="divide-y divide-[#32302c]">
        {CATEGORIES.map(({ key, label, icon }) => {
          const wCount = review.whiteCounts[key] || 0;
          const bCount = review.blackCounts[key] || 0;
          const isSelected = selectedClassification === key;

          return (
            <div
              key={key}
              onClick={() => onSelectClassification?.(isSelected ? null : key)}
              className={`flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-xs ${
                isSelected
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200'
                  : 'hover:bg-[#32302c] text-gray-300'
              }`}
            >
              {/* White Count */}
              <span
                className={`w-10 text-center font-bold ${
                  wCount > 0
                    ? key === 'blunder'
                      ? 'text-rose-400 font-extrabold'
                      : key === 'brilliant'
                      ? 'text-emerald-400 font-extrabold'
                      : 'text-gray-100'
                    : 'text-gray-600 font-normal'
                }`}
              >
                {wCount}
              </span>

              {/* Classification Label & Badge */}
              <div className="flex items-center gap-2 flex-1 justify-center">
                <Image
                  src={icon}
                  alt={label}
                  width={18}
                  height={18}
                  className="object-contain"
                />
                <span className="font-semibold text-gray-200">{label}</span>
              </div>

              {/* Black Count */}
              <span
                className={`w-10 text-center font-bold ${
                  bCount > 0
                    ? key === 'blunder'
                      ? 'text-rose-400 font-extrabold'
                      : key === 'brilliant'
                      ? 'text-emerald-400 font-extrabold'
                      : 'text-gray-100'
                    : 'text-gray-600 font-normal'
                }`}
              >
                {bCount}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
