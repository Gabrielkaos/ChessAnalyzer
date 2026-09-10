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
    <div className="w-full bg-[#262421] border border-[#363430] rounded-xl p-2.5 shadow-md flex items-center justify-between select-none">
      {/* Action Buttons: New Game, Import, Export, Live Engine */}
      <div className="flex items-center gap-1.5">
        {onNewGame && (
          <button
            onClick={onNewGame}
            title="New Game (Clear & Play Moves)"
            className="p-2 rounded-lg text-emerald-400 hover:text-white hover:bg-[#32302c] transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onOpenModal}
          title="Load New Game / Paste PGN"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
        <button
          onClick={onExportPgn}
          title="Export / Copy PGN"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] transition-colors"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          onClick={onToggleLiveEngine}
          title={liveEngineEnabled ? 'Disable Live Engine' : 'Enable Live Engine Evaluation'}
          className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold ${
            liveEngineEnabled
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-gray-400 hover:text-white hover:bg-[#32302c]'
          }`}
        >
          <Zap className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Buttons: First, Prev, Play/Pause, Next, Last */}
      <div className="flex items-center gap-1">
        <button
          onClick={onFirst}
          disabled={currentPly <= 0}
          title="Start (Home)"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronFirst className="w-5 h-5" />
        </button>
        <button
          onClick={onPrev}
          disabled={currentPly <= 0}
          title="Previous (Left Arrow)"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsPlaying((p) => !p)}
          title={isPlaying ? 'Pause (Space)' : 'Autoplay (Space)'}
          className="p-2 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-[#32302c] transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          onClick={onNext}
          disabled={currentPly >= maxPly}
          title="Next (Right Arrow)"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <button
          onClick={onLast}
          disabled={currentPly >= maxPly}
          title="End (End)"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLast className="w-5 h-5" />
        </button>
      </div>

      {/* Utility buttons: Flip board, Sound */}
      <div className="flex items-center gap-1">
        <button
          onClick={onFlip}
          title="Flip Board (F)"
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={toggleSound}
          title={soundOn ? 'Mute Sounds' : 'Unmute Sounds'}
          className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-[#32302c] transition-colors"
        >
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
