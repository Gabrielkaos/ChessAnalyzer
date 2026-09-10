'use client';

import React, { useEffect, useState } from 'react';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
  FolderOpen,
  Share2,
  PlusCircle,
} from 'lucide-react';
import { soundManager } from '@/lib/sounds';

interface BoardControlsProps {
  currentPly: number;
  maxPly: number;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onFlip: () => void;
  onOpenModal: () => void;
  onExportPgn: () => void;
  onNewGame?: () => void;
  liveEngineEnabled: boolean;
  onToggleLiveEngine: () => void;
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  currentPly,
  maxPly,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onFlip,
  onOpenModal,
  onExportPgn,
  onNewGame,
  liveEngineEnabled,
  onToggleLiveEngine,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);

  useEffect(() => {
    setSoundOn(soundManager.isEnabled());
  }, []);

  const toggleSound = () => {
    const nextState = soundManager.toggleSound();
    setSoundOn(nextState);
  };

  // Autoplay timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (currentPly < maxPly) {
          onNext();
        } else {
          setIsPlaying(false);
        }
      }, 1200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentPly, maxPly, onNext]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        onFirst();
      } else if (e.key === 'End') {
        e.preventDefault();
        onLast();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onFlip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext, onFirst, onLast, onFlip]);

  return (
    <div className="w-full bg-[#262421] border border-[#363430] rounded-xl p-2 sm:p-2.5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-2 select-none">
      {/* Mobile Top / Desktop Center: Navigation Buttons (First, Prev, Play/Pause, Next, Last) */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-1 w-full sm:w-auto order-1 sm:order-2">
        <button
          onClick={onFirst}
          disabled={currentPly <= 0}
          title="Start (Home)"
          className="p-2 sm:p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] disabled:opacity-30 disabled:hover:bg-transparent transition-colors touch-manipulation"
        >
          <ChevronFirst className="w-5 h-5 sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={onPrev}
          disabled={currentPly <= 0}
          title="Previous (Left Arrow)"
          className="p-2.5 sm:p-2 rounded-xl sm:rounded-lg bg-[#1f1e1b] sm:bg-transparent border border-[#363430] sm:border-0 text-gray-200 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] disabled:opacity-30 disabled:hover:bg-transparent transition-colors touch-manipulation shadow-sm sm:shadow-none"
        >
          <ChevronLeft className="w-6 h-6 sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? 'Pause (Space)' : 'Autoplay (Space)'}
          className="p-2.5 sm:p-2 rounded-xl sm:rounded-lg bg-emerald-500/15 sm:bg-transparent border border-emerald-500/30 sm:border-0 text-emerald-400 hover:text-emerald-300 hover:bg-[#32302c] active:bg-[#3d3a36] transition-colors touch-manipulation"
        >
          {isPlaying ? <Pause className="w-6 h-6 sm:w-5 sm:h-5" /> : <Play className="w-6 h-6 sm:w-5 sm:h-5" />}
        </button>
        <button
          onClick={onNext}
          disabled={currentPly >= maxPly}
          title="Next (Right Arrow)"
          className="p-2.5 sm:p-2 rounded-xl sm:rounded-lg bg-[#1f1e1b] sm:bg-transparent border border-[#363430] sm:border-0 text-gray-200 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] disabled:opacity-30 disabled:hover:bg-transparent transition-colors touch-manipulation shadow-sm sm:shadow-none"
        >
          <ChevronRight className="w-6 h-6 sm:w-5 sm:h-5" />
        </button>
        <button
          onClick={onLast}
          disabled={currentPly >= maxPly}
          title="End (End)"
          className="p-2 sm:p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] disabled:opacity-30 disabled:hover:bg-transparent transition-colors touch-manipulation"
        >
          <ChevronLast className="w-5 h-5 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Action Buttons & Utilities */}
      <div className="flex items-center justify-between sm:justify-start gap-1 w-full sm:w-auto order-2 sm:order-1 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-[#363430]/60">
        <div className="flex items-center gap-1">
          {onNewGame && (
            <button
              onClick={onNewGame}
              title="New Game (Clear & Play Moves)"
              className="p-1.5 sm:p-2 rounded-lg text-emerald-400 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] transition-colors touch-manipulation"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onOpenModal}
            title="Load New Game / Paste PGN"
            className="p-1.5 sm:p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] transition-colors touch-manipulation"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={onExportPgn}
            title="Export / Copy PGN"
            className="p-1.5 sm:p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] transition-colors touch-manipulation"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleLiveEngine}
            title={liveEngineEnabled ? 'Disable Live Engine' : 'Enable Live Engine Evaluation'}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold touch-manipulation ${
              liveEngineEnabled
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'text-gray-400 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36]'
            }`}
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>

        {/* Flip & Sound (Right side on desktop, right side of bottom bar on mobile) */}
        <div className="flex items-center gap-1 order-3">
          <button
            onClick={onFlip}
            title="Flip Board (F)"
            className="p-1.5 sm:p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] transition-colors touch-manipulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSound}
            title={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
            className="p-1.5 sm:p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] active:bg-[#3d3a36] transition-colors touch-manipulation"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
