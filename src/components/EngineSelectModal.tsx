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
  const [selectedEnginePreset, setSelectedEnginePreset] = useState<'stockfish' | 'custom'>('stockfish');
  const [activeType, setActiveType] = useState<EngineType>('builtin');
  const [nativeEngines, setNativeEngines] = useState<DiscoveredNativeEngine[]>([]);
  const [selectedNativePath, setSelectedNativePath] = useState<string>('');
  const [customPathInput, setCustomPathInput] = useState<string>('');
  const [customFileName, setCustomFileName] = useState<string>('');
  const [depth, setDepth] = useState<number>(18);
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
    setDepth(currentConfig.depth || 18);

    if (currentConfig.type === 'builtin') {
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
      if (engines.length > 0 && !selectedNativePath) {
        setSelectedNativePath(engines[0].path);
        setCustomPathInput(engines[0].path);
      }
    } finally {
      setScanning(false);
    }
  };

  const handleSelectPreset = (preset: 'stockfish' | 'custom') => {
    setSelectedEnginePreset(preset);
    if (preset === 'stockfish') {
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
      setSelectedEnginePreset('custom');
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

    if (selectedEnginePreset === 'stockfish') {
      finalConfig = {
        type: 'builtin',
        nativeName: 'Stockfish 19 (WASM)',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-3xl bg-[#262421] border border-[#3b3834] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#363430] bg-[#1f1e1b]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              <Cpu className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-100">Select Chess Engine</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 line-clamp-1">
                Official Stockfish 19 (NNUE WASM) or custom engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#363430] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Engine Status */}
        <div className="px-4 sm:px-6 py-2 sm:py-3 bg-[#1a1917] border-b border-[#363430] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-gray-400">Current Active:</span>
            <span className="font-bold text-amber-300">
              {currentConfig.type === 'native'
                ? currentConfig.nativeName || 'Custom Native UCI'
                : currentConfig.type === 'custom-file'
                ? currentConfig.customFileName || 'Custom File'
                : 'Stockfish 19 (WASM)'}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#262421] text-emerald-400 border border-emerald-500/30">
            DEPTH {currentConfig.depth || 18}
          </span>
        </div>

        {/* Engine Selection Body */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          {/* Section: Built-in Engines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Selected Engine
              </span>
              <span className="text-[11px] text-emerald-400 font-medium">Official In-Browser WASM</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {/* Stockfish 19 Card - In-Browser NNUE WASM */}
              <div
                onClick={() => handleSelectPreset('stockfish')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                  selectedEnginePreset === 'stockfish'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-950/20'
                    : 'bg-[#1f1e1b] border-[#363430] text-gray-300 hover:border-gray-600 hover:bg-[#23221e]'
                }`}
              >
                {selectedEnginePreset === 'stockfish' && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Active Engine
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-lg font-black shrink-0">
                      🐟
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>Stockfish 19</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 font-semibold">
                          NNUE WASM (Latest)
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">Official Stockfish 19 WebAssembly Engine</div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-300/90 leading-relaxed mb-3">
                    Latest official Stockfish 19 engine with embedded SFNN neural network. Runs 100% locally on your computer in your browser at 600k+ nodes/second. Zero server delays, zero network compute, instant accurate game reviews.
                  </p>
                </div>

                <div className="pt-2 border-t border-[#363430]/60 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    Fast Client Compute
                  </span>
                  <span className="text-gray-400 font-mono text-[10px]">✓ 100% In-Browser</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Analysis Depth */}
          <div className="p-4 bg-[#1f1e1b] rounded-xl border border-[#363430] space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-bold text-gray-200">Analysis Search Depth:</span>
              <span className="text-[11px] text-amber-300 font-semibold">
                ⚡ Higher depth = More accurate analysis (D18 recommended)
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {[
                { depth: 14, label: 'D14', desc: 'Fast' },
                { depth: 16, label: 'D16', desc: 'Balanced' },
                { depth: 18, label: 'D18', desc: 'Deep' },
                { depth: 20, label: 'D20', desc: 'Master' },
                { depth: 22, label: 'D22', desc: 'Elite' },
              ].map((item) => (
                <button
                  key={item.depth}
                  type="button"
                  onClick={() => setDepth(item.depth)}
                  className={`py-2 px-0.5 sm:px-1 rounded-lg text-center border transition-all ${
                    depth === item.depth
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm font-bold'
                      : 'bg-[#262421] border-[#363430] text-gray-400 hover:text-gray-200'
                  }`}
                  title={`${item.desc} (Depth ${item.depth})`}
                >
                  <div className="text-xs font-black">{item.label}</div>
                  <div className="text-[9px] sm:text-[10px] opacity-75">{item.desc}</div>
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
                      placeholder="e.g. /home/gabriel/engines/stockfish or /usr/games/stockfish"
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
            onClick={handleApply}
            className="flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-950/40 transition-all hover:scale-105"
          >
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Apply Selection (D{depth})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
