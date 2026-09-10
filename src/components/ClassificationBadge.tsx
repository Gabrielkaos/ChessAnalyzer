import React from 'react';
import { MoveClassification } from '@/types/chess';
import Image from 'next/image';

interface ClassificationBadgeProps {
  classification: MoveClassification;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CLASSIFICATION_CONFIG: Record<
  MoveClassification,
  { label: string; symbol: string; bg: string; text: string; border: string; iconSrc: string }
> = {
  brilliant: {
    label: 'Brilliant',
    symbol: '!!',
    bg: 'bg-emerald-500/20 text-emerald-400',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    iconSrc: '/badges/brilliant.png',
  },
  great: {
    label: 'Great',
    symbol: '!',
    bg: 'bg-sky-500/20 text-sky-400',
    text: 'text-sky-400',
    border: 'border-sky-500/40',
    iconSrc: '/badges/great.png',
  },
  best: {
    label: 'Best',
    symbol: '★',
    bg: 'bg-green-500/20 text-green-400',
    text: 'text-green-400',
    border: 'border-green-500/40',
    iconSrc: '/badges/best.png',
  },
  excellent: {
    label: 'Excellent',
    symbol: '✓',
    bg: 'bg-lime-500/20 text-lime-400',
    text: 'text-lime-400',
    border: 'border-lime-500/40',
    iconSrc: '/badges/excellent.png',
  },
  good: {
    label: 'Good',
    symbol: '👍',
    bg: 'bg-teal-500/20 text-teal-400',
    text: 'text-teal-400',
    border: 'border-teal-500/40',
    iconSrc: '/badges/good.png',
  },
  book: {
    label: 'Book',
    symbol: '📖',
    bg: 'bg-amber-700/20 text-amber-300',
    text: 'text-amber-300',
    border: 'border-amber-700/40',
    iconSrc: '/badges/book.png',
  },
  inaccuracy: {
    label: 'Inaccuracy',
    symbol: '?!',
    bg: 'bg-yellow-500/20 text-yellow-400',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
    iconSrc: '/badges/inaccuracy.png',
  },
  mistake: {
    label: 'Mistake',
    symbol: '?',
    bg: 'bg-orange-500/20 text-orange-400',
    text: 'text-orange-400',
    border: 'border-orange-500/40',
    iconSrc: '/badges/mistake.png',
  },
  miss: {
    label: 'Miss',
    symbol: '✕',
    bg: 'bg-red-500/20 text-red-400',
    text: 'text-red-400',
    border: 'border-red-500/40',
    iconSrc: '/badges/miss.png',
  },
  blunder: {
    label: 'Blunder',
    symbol: '??',
    bg: 'bg-rose-600/20 text-rose-400',
    text: 'text-rose-400',
    border: 'border-rose-600/40',
    iconSrc: '/badges/blunder.png',
  },
  legendary: {
    label: 'Legendary',
    symbol: '🌟',
    bg: 'bg-purple-500/20 text-purple-300',
    text: 'text-purple-300',
    border: 'border-purple-500/40',
    iconSrc: '/badges/legendary.png',
  },
};

export const ClassificationBadge: React.FC<ClassificationBadgeProps> = ({
  classification,
  showText = false,
  size = 'md',
  className = '',
}) => {
  const config = CLASSIFICATION_CONFIG[classification] || CLASSIFICATION_CONFIG.best;

  const sizePixels = size === 'sm' ? 16 : size === 'lg' ? 26 : 20;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.border} ${className}`}
      title={config.label}
    >
      <Image
        src={config.iconSrc}
        alt={config.label}
        width={sizePixels}
        height={sizePixels}
        className="inline-block object-contain"
      />
      {showText && <span>{config.label}</span>}
    </span>
  );
};
