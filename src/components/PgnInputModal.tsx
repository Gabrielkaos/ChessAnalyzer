'use client';

import React, { useState } from 'react';
import { SAMPLE_PGNS } from '@/lib/analyzer';
import { Upload, FileText, Globe, X, Play, Sparkles } from 'lucide-react';

interface PgnInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartReview: (pgn: string, depth: number) => void;
  isAnalyzing: boolean;
}

export const PgnInputModal: React.FC<PgnInputModalProps> = ({
  isOpen,
  onClose,
  onStartReview,
  isAnalyzing,
}) => {
  const [pgnText, setPgnText] = useState<string>(SAMPLE_PGNS.saved.pgn);
  const [selectedDepth, setSelectedDepth] = useState<number>(20);
  const [activeTab, setActiveTab] = useState<'paste' | 'samples' | 'online'>('paste');
  const [username, setUsername] = useState<string>('');
  const [platform, setPlatform] = useState<'chesscom' | 'lichess'>('chesscom');
  const [onlineLoading, setOnlineLoading] = useState<boolean>(false);
  const [onlineError, setOnlineError] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPgnText(content);
        setActiveTab('paste');
      }
    };
    reader.readAsText(file);
  };

  const handleFetchOnline = async () => {
    if (!username.trim()) return;
    setOnlineLoading(true);
    setOnlineError('');

    try {
      if (platform === 'chesscom') {
        // Fetch last month archives
        const archivesRes = await fetch(
          `https://api.chess.com/pub/player/${encodeURIComponent(username.trim().toLowerCase())}/games/archives`
        );
        if (!archivesRes.ok) throw new Error('Player not found on Chess.com');
        const archives = await archivesRes.json();
        const lastMonthUrl = archives.archives?.[archives.archives.length - 1];
        if (!lastMonthUrl) throw new Error('No games found for this player.');

        const gamesRes = await fetch(lastMonthUrl);
        const gamesData = await gamesRes.json();
        const games = gamesData.games || [];
        if (games.length === 0) throw new Error('No games found in recent archive.');

        const latestGame = games[games.length - 1];
        if (latestGame.pgn) {
          setPgnText(latestGame.pgn);
          setActiveTab('paste');
        } else {
          throw new Error('Could not retrieve PGN for latest game.');
        }
      } else {
        // Lichess
        const res = await fetch(
          `https://lichess.org/api/games/user/${encodeURIComponent(username.trim())}?max=1&pgnInJson=true`,
          {
            headers: { Accept: 'application/x-ndjson' },
          }
        );
        if (!res.ok) throw new Error('Player not found on Lichess');
        const text = await res.text();
        const firstLine = text.trim().split('\n')[0];
        const data = JSON.parse(firstLine);
        if (data.pgn) {
          setPgnText(data.pgn);
          setActiveTab('paste');
        } else {
          throw new Error('Could not retrieve PGN from Lichess.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch game';
      setOnlineError(msg);
    } finally {
      setOnlineLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-[#262421] border border-[#3b3834] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#363430] bg-[#1f1e1b]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-100">Load & Review Game</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 line-clamp-1">Import PGN, pick a famous masterpiece, or fetch your account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#363430] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#363430] bg-[#1a1917] px-2 sm:px-6 pt-1.5 sm:pt-2 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-emerald-500 text-emerald-400 bg-[#262421]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Paste PGN</span>
          </button>
          <button
            onClick={() => setActiveTab('samples')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'samples'
                ? 'border-emerald-500 text-emerald-400 bg-[#262421]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Sample Games</span>
          </button>
          <button
            onClick={() => setActiveTab('online')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'online'
                ? 'border-emerald-500 text-emerald-400 bg-[#262421]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Import Online</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-3 sm:space-y-4">
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">
                  PGN Notation:
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Upload .pgn file
                  <input
                    type="file"
                    accept=".pgn"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                value={pgnText}
                onChange={(e) => setPgnText(e.target.value)}
                rows={6}
                placeholder="Paste PGN here (e.g. 1. e4 e5 2. Nf3 Nc6 3. Bc4...)"
                className="w-full p-2.5 sm:p-3 bg-[#181715] border border-[#363430] rounded-xl text-xs text-gray-200 font-mono focus:outline-none focus:border-emerald-500 resize-none sm:rows-9"
              />
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="grid grid-cols-1 gap-2.5">
              {Object.entries(SAMPLE_PGNS).map(([key, sample]) => (
                <div
                  key={key}
                  onClick={() => {
                    setPgnText(sample.pgn);
                    setActiveTab('paste');
                  }}
                  className="p-3 bg-[#1f1e1b] border border-[#363430] hover:border-emerald-500/50 hover:bg-[#2c2a26] rounded-xl cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-100">{sample.title}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                      Load Game
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{sample.desc}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'online' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlatform('chesscom')}
                  className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors ${
                    platform === 'chesscom'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-[#1f1e1b] border-[#363430] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Chess.com
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform('lichess')}
                  className={`p-3 rounded-xl border text-center font-bold text-xs transition-colors ${
                    platform === 'lichess'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-[#1f1e1b] border-[#363430] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Lichess.org
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                  Enter {platform === 'chesscom' ? 'Chess.com' : 'Lichess'} Username:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. MagnusCarlsen, Hikaru"
                    className="flex-1 px-3 py-2 bg-[#181715] border border-[#363430] rounded-xl text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchOnline()}
                  />
                  <button
                    type="button"
                    onClick={handleFetchOnline}
                    disabled={onlineLoading || !username.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    {onlineLoading ? 'Fetching...' : 'Fetch Latest Game'}
                  </button>
                </div>
              </div>

              {onlineError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                  {onlineError}
                </div>
              )}
            </div>
          )}

          {/* Depth selection */}
          <div className="pt-3 border-t border-[#363430] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-gray-200">Analysis Depth:</span>
              <p className="text-[11px] text-amber-300 font-semibold">
                ⚡ Higher depth = More accurate analysis
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { depth: 18, label: 'D18', desc: 'Fast' },
                { depth: 20, label: 'D20', desc: 'Balanced' },
                { depth: 22, label: 'D22', desc: 'Deep' },
                { depth: 26, label: 'D26', desc: 'Master' },
              ].map((item) => (
                <button
                  key={item.depth}
                  type="button"
                  onClick={() => setSelectedDepth(item.depth)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    selectedDepth === item.depth
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-[#1f1e1b] border-[#363430] text-gray-400 hover:text-gray-200'
                  }`}
                  title={`${item.desc} (Depth ${item.depth})`}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] font-normal opacity-75 ml-1">({item.desc})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-[#363430] bg-[#1f1e1b] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#363430] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onStartReview(pgnText, selectedDepth);
              onClose();
            }}
            disabled={!pgnText.trim() || isAnalyzing}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-950/40 transition-all hover:scale-105"
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />
            <span>Start Game Review</span>
          </button>
        </div>
      </div>
    </div>
  );
};
