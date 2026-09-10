'use client';

import React, { useState, useEffect } from 'react';
import {
  engineManager,
  DiscoveredNativeEngine,
  EngineType,
  EngineConfig,
} from '@/lib/engineManager';
import {
  Cpu,
  X,
  CheckCircle2,
  HardDrive,
  Globe,
  FileCode,
  Upload,
  Play,
  Terminal,
  AlertCircle,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';

interface EngineSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEngineChanged?: (config: EngineConfig) => void;
}

export const EngineSelectModal: React.FC<EngineSelectModalProps> = ({
  isOpen,
  onClose,
  onEngineChanged,
}) => {
  const [selectedEnginePreset, setSelectedEnginePreset] = useState<'goob' | 'stockfish' | 'custom'>('goob');
  const [activeType, setActiveType] = useState<EngineType>('native');
  const [nativeEngines, setNativeEngines] = useState<DiscoveredNativeEngine[]>([]);
  const [selectedNativePath, setSelectedNativePath] = useState<string>('');
  const [customPathInput, setCustomPathInput] = useState<string>('');
  const [customFileName, setCustomFileName] = useState<string>('');
  const [depth, setDepth] = useState<number>(20);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    name?: string;
    author?: string;
    error?: string;
  } | null>(null);

  const [scanning, setScanning] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    const currentConfig = engineManager.getConfig();
    setActiveType(currentConfig.type);
    setSelectedNativePath(currentConfig.nativePath);
    setCustomPathInput(currentConfig.nativePath);
    setCustomFileName(currentConfig.customFileName);
    setDepth(currentConfig.depth || 20);

    if (currentConfig.type === 'native' && (currentConfig.nativeName?.includes('GOOB') || !currentConfig.nativeName)) {
      setSelectedEnginePreset('goob');
    } else if (currentConfig.type === 'builtin') {
      setSelectedEnginePreset('stockfish');
    } else {
      setSelectedEnginePreset('custom');
      setShowAdvanced(true);
    }

    fetchNativeEngines();
  }, [isOpen]);

  const fetchNativeEngines = async () => {
    setScanning(true);
    try {
      const engines = await engineManager.detectNativeEngines();
      setNativeEngines(engines);
      if (engines.length > 0) {
        const goob = engines.find((e) => e.name.includes('GOOB')) || engines[0];
        if (!selectedNativePath) {
          setSelectedNativePath(goob.path);
          setCustomPathInput(goob.path);
        }
      }
    } finally {
      setScanning(false);
    }
  };

  const handleSelectPreset = (preset: 'goob' | 'stockfish') => {
    setSelectedEnginePreset(preset);
    if (preset === 'goob') {
      setActiveType('native');
      const optimal = nativeEngines.find((e) => e.isDefault) || nativeEngines.find((e) => e.name.includes('GOOB')) || nativeEngines[0];
      const goobPath = optimal?.path || selectedNativePath || 'default';
      setSelectedNativePath(goobPath);
      setCustomPathInput(goobPath);
    } else if (preset === 'stockfish') {
      setActiveType('builtin');
    }
  };

  if (!isOpen) return null;

  const handleTestPath = async () => {
    const targetPath = customPathInput.trim() || selectedNativePath;
    if (!targetPath) return;

    setTesting(true);
    setTestResult(null);

    const result = await engineManager.testNativeEngine(targetPath);
    setTestResult(result);
    setTesting(false);
  };

  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTesting(true);
    const result = await engineManager.setCustomEngineFile(file);
    setTesting(false);

    if (result.success) {
      setCustomFileName(result.name || file.name);
      setActiveType('custom-file');
      setTestResult({
        success: true,
        name: result.name || file.name,
        author: 'Uploaded JS/WASM Worker',
      });
    } else {
      setTestResult({
        success: false,
        name: '',
        author: '',
        error: result.error || 'Failed to initialize engine file',
      });
    }
  };

  const handleApply = () => {
    let finalConfig: EngineConfig;

    if (selectedEnginePreset === 'goob') {
      const chosen = nativeEngines.find((e) => e.path === selectedNativePath) || nativeEngines.find((e) => e.isDefault) || nativeEngines.find((e) => e.name.includes('GOOB'));
      finalConfig = {
        type: 'native',
        nativeName: chosen?.name || 'GOOB 2.2-BETA',
        nativePath: chosen?.path || customPathInput.trim() || selectedNativePath || 'default',
        customFileName: '',
        depth,
      };
    } else if (selectedEnginePreset === 'stockfish') {
      finalConfig = {
        type: 'builtin',
        nativeName: '',
        nativePath: '',
        customFileName: '',
        depth,
      };
    } else {
      // Custom engine
      let finalNativeName = 'Custom Native UCI';
      const found = nativeEngines.find((e) => e.path === (customPathInput || selectedNativePath));
      if (found) {
        finalNativeName = found.name;
      } else if (testResult?.name) {
        finalNativeName = testResult.name;
      }

      finalConfig = {
        type: activeType,
        nativePath: customPathInput.trim() || selectedNativePath,
        nativeName: finalNativeName,
        customFileName,
        depth,
      };
    }

    engineManager.setConfig(finalConfig);
    onEngineChanged?.(finalConfig);
    onClose();
  };

  const currentConfig = engineManager.getConfig();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-2xl bg-[#262421] border border-[#3b3834] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#363430] bg-[#1f1e1b]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">Select Chess Engine</h2>
              <p className="text-xs text-gray-400">
                Choose between built-in GOOB 2.2-BETA, Stockfish 10, or a custom engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#363430] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Engine Status */}
        <div className="px-6 py-3 bg-[#1a1917] border-b border-[#363430] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-gray-400">Current Active:</span>
            <span className="font-bold text-amber-300">
              {currentConfig.type === 'native'
                ? currentConfig.nativeName || 'GOOB 2.2-BETA'
                : currentConfig.type === 'custom-file'
                ? currentConfig.customFileName || 'Custom File'
                : 'Stockfish 10 (WebAssembly)'}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#262421] text-emerald-400 border border-emerald-500/30">
            DEPTH {currentConfig.depth || 20}
          </span>
        </div>

        {/* Engine Selection Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Section: Built-in Engines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Built-in Engines
              </span>
              <span className="text-[11px] text-gray-500">1-Click Fast Switch</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* 1. Stockfish 10 Card - Local Compute */}
              <div
                onClick={() => handleSelectPreset('stockfish')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                  selectedEnginePreset === 'stockfish'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-950/20'
                    : 'bg-[#1f1e1b] border-[#363430] text-gray-300 hover:border-gray-600 hover:bg-[#23221e]'
                }`}
              >
                {selectedEnginePreset === 'stockfish' && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Selected
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-base font-black">
                      🐟
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>Stockfish 10</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                          WASM
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">Local Machine Compute</div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300/90 leading-relaxed mb-3">
                    Runs 100% on your device&apos;s CPU inside your browser using Web Workers. Zero server latency, instant evaluation, works anywhere.
                  </p>
                </div>

                <div className="pt-2 border-t border-[#363430]/60 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Recommended for Web
                  </span>
                  <span className="text-gray-400 font-mono text-[10px]">✓ Your Local CPU</span>
                </div>
              </div>

              {/* 2. GOOB 2.2-BETA Card */}
              <div
                onClick={() => handleSelectPreset('goob')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                  selectedEnginePreset === 'goob'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-200 shadow-lg shadow-amber-950/20'
                    : 'bg-[#1f1e1b] border-[#363430] text-gray-300 hover:border-gray-600 hover:bg-[#23221e]'
                }`}
              >
                {selectedEnginePreset === 'goob' && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Selected
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-base font-black">
                      🦅
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span>GOOB 2.2-BETA</span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                          {nativeEngines.find((e) => e.path === selectedNativePath)?.features?.split(' ')[0] || 'Native'}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">by Gabriel Montes</div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300/90 leading-relaxed mb-3">
                    Fast native UCI binary in C with aggressive search heuristics. Auto-probes CPU to select optimal ISA tier (v3 PEXT / v2 / baseline SSE2).
                  </p>

                  {/* Multi-tier Build Selector if GOOB is selected */}
                  {selectedEnginePreset === 'goob' && nativeEngines.filter((e) => e.name.includes('GOOB')).length > 1 && (
                    <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                        Select CPU Architecture Build:
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {nativeEngines
                          .filter((e) => e.name.includes('GOOB'))
                          .map((eng) => {
                            const isSelected = selectedNativePath === eng.path || (!selectedNativePath && eng.isDefault);
                            return (
                              <div
                                key={eng.path}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedNativePath(eng.path);
                                  setCustomPathInput(eng.path);
                                }}
                                className={`px-2 py-1.5 rounded-lg border text-[11px] cursor-pointer flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-amber-500/25 border-amber-400 text-white font-semibold'
                                    : 'bg-[#181715] border-[#363430] text-gray-300 hover:border-amber-500/40'
                                }`}
                              >
                                <div className="truncate mr-2">
                                  <div className="truncate flex items-center gap-1">
                                    <span>{eng.name}</span>
                                    {eng.isDefault && (
                                      <span className="text-[8px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">
                                        Optimal
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-gray-400 truncate">{eng.features}</div>
                                </div>
                                <span className="text-[10px] text-emerald-400 shrink-0 font-mono">
                                  {eng.isCompatible ? '✓ Ready' : '—'}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 mt-2 border-t border-[#363430]/60 flex items-center justify-between text-[11px]">
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Local PC / Linux
                  </span>
                  <span className="text-gray-400 font-mono text-[10px]">
                    {nativeEngines.some((e) => e.isCompatible) ? '✓ Host Compatible' : 'Bundled Binary'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Analysis Depth */}
          <div className="p-4 bg-[#1f1e1b] rounded-xl border border-[#363430] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-bold text-gray-200">Analysis Search Depth:</span>
              <span className="text-[11px] text-amber-300 font-semibold">
                ⚡ Higher depth = More accurate analysis
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { depth: 18, label: 'D18', desc: 'Fast' },
                { depth: 20, label: 'D20', desc: 'Balanced' },
                { depth: 22, label: 'D22', desc: 'Deep' },
                { depth: 26, label: 'D26', desc: 'Master' },
              ].map((item) => (
                <button
                  key={item.depth}
                  type="button"
                  onClick={() => setDepth(item.depth)}
                  className={`py-2 px-1 rounded-lg text-center border transition-all ${
                    depth === item.depth
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-bold'
                      : 'bg-[#262421] border-[#363430] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className="text-xs font-black">{item.label}</div>
                  <div className="text-[10px] opacity-75">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Advanced / Custom Engine Accordion */}
          <div className="border border-[#363430] rounded-xl bg-[#1f1e1b] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-300 hover:bg-[#262421] transition-colors"
            >
              <span className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                Advanced: Custom UCI Executable or .js/.wasm File
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 border-t border-[#363430] space-y-4 bg-[#1a1917]">
                {/* Custom Executable Path */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                      Specify Local UCI Engine Path:
                    </label>
                    <button
                      type="button"
                      onClick={fetchNativeEngines}
                      disabled={scanning}
                      className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${scanning ? 'animate-spin' : ''}`} />
                      Rescan
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPathInput}
                      onChange={(e) => {
                        setCustomPathInput(e.target.value);
                        setSelectedEnginePreset('custom');
                        setActiveType('native');
                      }}
                      placeholder="e.g. /home/gabriel/engines/stockfish or ChessAnalyzer/engines/GOOB-2.2-BETA-native"
                      className="flex-1 px-3 py-2 bg-[#141312] border border-[#363430] rounded-xl text-xs text-gray-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleTestPath}
                      disabled={testing || !customPathInput.trim()}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      {testing ? 'Testing...' : 'Test'}
                    </button>
                  </div>

                  {testResult && (
                    <div
                      className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                        testResult.success
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>✓ UCI OK: {testResult.name} {testResult.author ? `(${testResult.author})` : ''}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{testResult.error || 'Failed to connect'}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Upload Custom Worker File */}
                <div className="pt-3 border-t border-[#363430]/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-sky-400" />
                      Load Custom Engine File (.js / .wasm)
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {customFileName ? `Loaded: ${customFileName}` : 'Select a custom Web Worker engine script'}
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    Upload File
                    <input
                      type="file"
                      accept=".js,.wasm"
                      onChange={handleCustomFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#363430] bg-[#1f1e1b] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-[#363430] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/40 transition-all hover:scale-105"
          >
            <CheckCircle2 className="w-4 h-4" />
            Apply Selection
          </button>
        </div>
      </div>
    </div>
  );
};
