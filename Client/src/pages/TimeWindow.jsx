import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Layers,
  Check,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";

// Format seconds into MM:SS or HH:MM:SS
function formatDuration(totalSeconds) {
  if (totalSeconds < 0 || isNaN(totalSeconds)) totalSeconds = 0;
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);

  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

// Generate TradingView chart URL fallback
function getChartUrl(asset) {
  if (asset?.chart_link && asset.chart_link.trim() !== "") {
    return asset.chart_link;
  }
  const sym = (asset?.symbol || "").replace(/c$/i, "").replace(/m$/i, "");
  return `https://www.tradingview.com/chart/?symbol=FX:${encodeURIComponent(sym)}`;
}

// Today's date string YYYY-MM-DD
function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const STORAGE_SESSION_KEY = "lyquant_timewindow_session_state";
const STORAGE_MARKS_KEY = "lyquant_timewindow_daily_marks";

const PRESET_WINDOWS = [
  { label: "30m", hours: 0.5 },
  { label: "1h", hours: 1 },
  { label: "90m", hours: 1.5 },
  { label: "2h", hours: 2 },
  { label: "3h", hours: 3 },
];

export default function TimeWindow() {
  const {
    data: trackedResponse,
    loading: trackedLoading,
    error: trackedError,
  } = usePolling(API.trackedAssets, 2000);

  const {
    data: positionsResponse,
    loading: positionsLoading,
    error: positionsError,
  } = usePolling(API.positions, 2000);

  // Restore initial state from localStorage
  const initial = useMemo(() => {
    try {
      const today = getTodayKey();
      const raw = localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.date === today) {
          const now = Date.now();
          let cardRem = p.cardRemainingSeconds ?? 0;
          let cardEnd = p.cardEndTime ?? null;
          let isCardRunning = p.isCardTimerRunning ?? false;

          if (isCardRunning && cardEnd) {
            const diff = Math.max(0, Math.ceil((cardEnd - now) / 1000));
            cardRem = diff;
            if (diff === 0) {
              isCardRunning = false;
            }
          }

          let execRem = p.executionRemaining ?? 1800;
          let execEnd = p.execEndTime ?? null;
          let isExecRunning = p.isExecutionRunning ?? false;

          if (isExecRunning && execEnd) {
            const diff = Math.max(0, Math.ceil((execEnd - now) / 1000));
            execRem = diff;
            if (diff === 0) {
              isExecRunning = false;
            }
          }

          return {
            selectedHours: p.selectedHours ?? 1,
            activePhase: p.activePhase ?? "IDLE",
            isExecutionRunning: isExecRunning,
            currentAnalyzingSymbol: p.currentAnalyzingSymbol ?? null,
            isCardTimerRunning: isCardRunning,
            analyzedSymbols: new Set(p.analyzedSymbols || []),
            cardRemainingSeconds: cardRem,
            executionRemaining: execRem,
            cardEndTime: cardEnd,
            execEndTime: execEnd,
          };
        }
      }
    } catch {
      // Fallback
    }
    return {
      selectedHours: 1,
      activePhase: "IDLE",
      isExecutionRunning: false,
      currentAnalyzingSymbol: null,
      isCardTimerRunning: false,
      analyzedSymbols: new Set(),
      cardRemainingSeconds: 0,
      executionRemaining: 1800,
      cardEndTime: null,
      execEndTime: null,
    };
  }, []);

  const [selectedHours, setSelectedHours] = useState(initial.selectedHours);
  const [activePhase, setActivePhase] = useState(initial.activePhase);
  const [isExecutionRunning, setIsExecutionRunning] = useState(initial.isExecutionRunning);

  const [currentAnalyzingSymbol, setCurrentAnalyzingSymbol] = useState(initial.currentAnalyzingSymbol);
  const [isCardTimerRunning, setIsCardTimerRunning] = useState(initial.isCardTimerRunning);
  const [analyzedSymbols, setAnalyzedSymbols] = useState(initial.analyzedSymbols);
  const [cardRemainingSeconds, setCardRemainingSeconds] = useState(initial.cardRemainingSeconds);
  const [executionRemaining, setExecutionRemaining] = useState(initial.executionRemaining);

  // Exact target completion timestamps (wall-clock)
  const cardEndTimeRef = useRef(initial.cardEndTime);
  const execEndTimeRef = useRef(initial.execEndTime);

  // Persistent daily marks
  const [dailyMarks, setDailyMarks] = useState(() => {
    try {
      const today = getTodayKey();
      const raw = localStorage.getItem(STORAGE_MARKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.date === today && parsed?.marks) {
          return parsed.marks;
        }
      }
    } catch {
      // Fallback
    }
    return {};
  });

  // Keep state synced to localStorage
  const stateRef = useRef({});
  stateRef.current = {
    selectedHours,
    activePhase,
    isExecutionRunning,
    currentAnalyzingSymbol,
    isCardTimerRunning,
    analyzedSymbols,
    cardRemainingSeconds,
    executionRemaining,
  };

  const persistSession = () => {
    try {
      const s = stateRef.current;
      const payload = {
        date: getTodayKey(),
        selectedHours: s.selectedHours,
        activePhase: s.activePhase,
        isExecutionRunning: s.isExecutionRunning,
        currentAnalyzingSymbol: s.currentAnalyzingSymbol,
        isCardTimerRunning: s.isCardTimerRunning,
        analyzedSymbols: Array.from(s.analyzedSymbols),
        cardRemainingSeconds: s.cardRemainingSeconds,
        executionRemaining: s.executionRemaining,
        cardEndTime: cardEndTimeRef.current,
        execEndTime: execEndTimeRef.current,
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    persistSession();
  }, [
    selectedHours,
    activePhase,
    isExecutionRunning,
    currentAnalyzingSymbol,
    isCardTimerRunning,
    analyzedSymbols,
    cardRemainingSeconds,
    executionRemaining,
  ]);

  // Prevent accidental reload while timer is running
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (
        (activePhase === "ANALYSIS" && isCardTimerRunning) ||
        (activePhase === "EXECUTION" && isExecutionRunning)
      ) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activePhase, isCardTimerRunning, isExecutionRunning]);

  // Tab Title Sync
  useEffect(() => {
    if (activePhase === "ANALYSIS" && currentAnalyzingSymbol) {
      const timeStr = formatDuration(cardRemainingSeconds);
      const prefix = isCardTimerRunning ? "●" : "⏸";
      document.title = `${prefix} [${timeStr}] ${currentAnalyzingSymbol} - LYQUANT`;
    } else if (activePhase === "EXECUTION") {
      const timeStr = formatDuration(executionRemaining);
      const prefix = isExecutionRunning ? "●" : "⏸";
      document.title = `${prefix} [${timeStr}] Execution - LYQUANT`;
    } else if (activePhase === "FINISHED") {
      document.title = `Completed - LYQUANT`;
    } else {
      document.title = "LYQUANT - Time Window";
    }

    return () => {
      document.title = "LYQUANT";
    };
  }, [
    activePhase,
    currentAnalyzingSymbol,
    cardRemainingSeconds,
    isCardTimerRunning,
    executionRemaining,
    isExecutionRunning,
  ]);

  const handleSetMark = (symbol, status) => {
    setDailyMarks((prev) => {
      const next = { ...prev };
      if (next[symbol] === status) {
        delete next[symbol];
      } else {
        next[symbol] = status;
      }
      try {
        localStorage.setItem(
          STORAGE_MARKS_KEY,
          JSON.stringify({ date: getTodayKey(), marks: next })
        );
      } catch {
        // Fallback
      }
      return next;
    });
  };

  const trackedAssets = useMemo(() => {
    return trackedResponse?.data || [];
  }, [trackedResponse?.data]);

  const openPositions = useMemo(() => {
    return positionsResponse?.data?.positions || [];
  }, [positionsResponse?.data?.positions]);

  const account = positionsResponse?.data?.account;
  const isCent = account?.is_cent ?? account?.currency === "USC";
  const currencyUnit = isCent ? "USC" : "USD";
  const currencyPrefix = isCent ? "¢" : "$";

  const positionsBySymbol = useMemo(() => {
    const map = new Map();
    for (const pos of openPositions) {
      const sym = pos.symbol;
      if (!map.has(sym)) {
        map.set(sym, []);
      }
      map.get(sym).push(pos);
    }
    return map;
  }, [openPositions]);

  const assetsWithPositionInfo = useMemo(() => {
    return trackedAssets.map((asset) => {
      const symbolPositions = positionsBySymbol.get(asset.symbol) || [];
      const hasPosition = symbolPositions.length > 0;
      const totalLots = symbolPositions.reduce(
        (sum, p) => sum + (Number(p.lots) || 0),
        0
      );
      const totalProfit = symbolPositions.reduce(
        (sum, p) => sum + (Number(p.profit) || 0),
        0
      );

      return {
        ...asset,
        positions: symbolPositions,
        hasPosition,
        positionCount: symbolPositions.length,
        totalLots,
        totalProfit,
      };
    });
  }, [trackedAssets, positionsBySymbol]);

  const eligibleAnalysisAssets = useMemo(() => {
    return assetsWithPositionInfo.filter((a) => !a.hasPosition);
  }, [assetsWithPositionInfo]);

  const totalAnalysisSeconds = useMemo(() => {
    return Math.round((selectedHours * 3600) / 2);
  }, [selectedHours]);

  const totalExecutionSeconds = useMemo(() => {
    return Math.round((selectedHours * 3600) / 2);
  }, [selectedHours]);

  const timePerAssetSeconds = useMemo(() => {
    if (eligibleAnalysisAssets.length === 0) return totalAnalysisSeconds;
    return Math.max(1, Math.floor(totalAnalysisSeconds / eligibleAnalysisAssets.length));
  }, [totalAnalysisSeconds, eligibleAnalysisAssets.length]);

  const handleSelectPreset = (hours) => {
    setSelectedHours(hours);
    setActivePhase("IDLE");
    setCurrentAnalyzingSymbol(null);
    setIsCardTimerRunning(false);
    setAnalyzedSymbols(new Set());
    cardEndTimeRef.current = null;
    execEndTimeRef.current = null;
    const half = Math.round((hours * 3600) / 2);
    setExecutionRemaining(half);
    setIsExecutionRunning(false);
  };

  const handleFullReset = () => {
    setActivePhase("IDLE");
    setCurrentAnalyzingSymbol(null);
    setIsCardTimerRunning(false);
    setAnalyzedSymbols(new Set());
    cardEndTimeRef.current = null;
    execEndTimeRef.current = null;
    setExecutionRemaining(totalExecutionSeconds);
    setIsExecutionRunning(false);
    localStorage.removeItem(STORAGE_SESSION_KEY);
  };

  // Start analyzing a specific card with exact wall-clock end time
  const handleStartCardAnalysis = (symbol) => {
    setActivePhase("ANALYSIS");
    setCurrentAnalyzingSymbol(symbol);
    setCardRemainingSeconds(timePerAssetSeconds);
    cardEndTimeRef.current = Date.now() + timePerAssetSeconds * 1000;
    setIsCardTimerRunning(true);
  };

  const handleToggleCardTimer = () => {
    if (isCardTimerRunning) {
      // Pause: calculate and freeze remaining seconds
      if (cardEndTimeRef.current) {
        const remaining = Math.max(0, Math.ceil((cardEndTimeRef.current - Date.now()) / 1000));
        setCardRemainingSeconds(remaining);
      }
      cardEndTimeRef.current = null;
      setIsCardTimerRunning(false);
    } else {
      // Resume: set new target end time based on cardRemainingSeconds
      const rem = cardRemainingSeconds > 0 ? cardRemainingSeconds : timePerAssetSeconds;
      setCardRemainingSeconds(rem);
      cardEndTimeRef.current = Date.now() + rem * 1000;
      setIsCardTimerRunning(true);
    }
  };

  const handleFinishCurrentAsset = (symbol) => {
    const nextSet = new Set(analyzedSymbols);
    nextSet.add(symbol);
    setAnalyzedSymbols(nextSet);

    const nextAsset = eligibleAnalysisAssets.find(
      (a) => !nextSet.has(a.symbol) && a.symbol !== symbol
    );

    if (nextAsset) {
      setCurrentAnalyzingSymbol(nextAsset.symbol);
      setCardRemainingSeconds(timePerAssetSeconds);
      cardEndTimeRef.current = Date.now() + timePerAssetSeconds * 1000;
      setIsCardTimerRunning(true);
    } else {
      setCurrentAnalyzingSymbol(null);
      setIsCardTimerRunning(false);
      cardEndTimeRef.current = null;
      setActivePhase("EXECUTION");
      execEndTimeRef.current = Date.now() + executionRemaining * 1000;
      setIsExecutionRunning(true);
    }
  };

  // HIGH-PRECISION WALL-CLOCK TICK LOOP FOR CARD TIMER (Ticking every 100ms)
  useEffect(() => {
    if (!isCardTimerRunning || !currentAnalyzingSymbol || activePhase !== "ANALYSIS") {
      return;
    }

    const interval = setInterval(() => {
      if (!cardEndTimeRef.current) return;
      const msLeft = cardEndTimeRef.current - Date.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));

      setCardRemainingSeconds(secLeft);

      if (secLeft <= 0) {
        clearInterval(interval);
        handleFinishCurrentAsset(currentAnalyzingSymbol);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isCardTimerRunning, currentAnalyzingSymbol, activePhase, eligibleAnalysisAssets, analyzedSymbols, timePerAssetSeconds]);

  // HIGH-PRECISION WALL-CLOCK TICK LOOP FOR EXECUTION TIMER (Ticking every 100ms)
  useEffect(() => {
    if (!isExecutionRunning || activePhase !== "EXECUTION") {
      return;
    }

    const interval = setInterval(() => {
      if (!execEndTimeRef.current) return;
      const msLeft = execEndTimeRef.current - Date.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));

      setExecutionRemaining(secLeft);

      if (secLeft <= 0) {
        clearInterval(interval);
        setIsExecutionRunning(false);
        setActivePhase("FINISHED");
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isExecutionRunning, activePhase]);

  const handleStartExecution = () => {
    if (activePhase === "IDLE" || activePhase === "ANALYSIS") {
      setIsCardTimerRunning(false);
      setCurrentAnalyzingSymbol(null);
      cardEndTimeRef.current = null;
    }
    setActivePhase("EXECUTION");
    execEndTimeRef.current = Date.now() + executionRemaining * 1000;
    setIsExecutionRunning(true);
  };

  const handleToggleExecutionTimer = () => {
    if (isExecutionRunning) {
      if (execEndTimeRef.current) {
        const rem = Math.max(0, Math.ceil((execEndTimeRef.current - Date.now()) / 1000));
        setExecutionRemaining(rem);
      }
      execEndTimeRef.current = null;
      setIsExecutionRunning(false);
    } else {
      const rem = executionRemaining > 0 ? executionRemaining : totalExecutionSeconds;
      setExecutionRemaining(rem);
      execEndTimeRef.current = Date.now() + rem * 1000;
      setIsExecutionRunning(true);
    }
  };

  const totalEligibleCount = eligibleAnalysisAssets.length;
  const completedCount = useMemo(() => {
    return eligibleAnalysisAssets.filter((a) => analyzedSymbols.has(a.symbol)).length;
  }, [eligibleAnalysisAssets, analyzedSymbols]);

  const progressPercentage = useMemo(() => {
    if (totalEligibleCount === 0) return 0;
    return Math.round((completedCount / totalEligibleCount) * 100);
  }, [completedCount, totalEligibleCount]);

  // Current active asset time progress (0% to 100%)
  const currentAssetProgress = useMemo(() => {
    if (!currentAnalyzingSymbol || timePerAssetSeconds <= 0) return 0;
    const elapsed = Math.max(0, timePerAssetSeconds - cardRemainingSeconds);
    return Math.min(100, Math.round((elapsed / timePerAssetSeconds) * 100));
  }, [currentAnalyzingSymbol, timePerAssetSeconds, cardRemainingSeconds]);

  // Execution elapsed progress (0% to 100%)
  const executionProgress = useMemo(() => {
    if (totalExecutionSeconds <= 0) return 0;
    const elapsed = Math.max(0, totalExecutionSeconds - executionRemaining);
    return Math.min(100, Math.round((elapsed / totalExecutionSeconds) * 100));
  }, [totalExecutionSeconds, executionRemaining]);

  const error = trackedError || positionsError;
  const loading =
    (trackedLoading || positionsLoading) && trackedAssets.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Top Minimal Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Time Window</span>
            <span className="text-xs font-normal text-slate-400 font-mono">
              ({trackedAssets.length} assets)
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Split daily session into chart analysis and execution.
          </p>
        </div>

        {/* Minimal Presets + Reset */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
            {PRESET_WINDOWS.map((preset) => {
              const isSelected = selectedHours === preset.hours;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectPreset(preset.hours)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white text-slate-900 font-semibold shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleFullReset}
            title="Reset Session"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Two Subtle Section Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Section 1: Analyze Chart */}
        <div
          className={`rounded-xl border p-4 bg-white transition-all ${
            activePhase === "ANALYSIS"
              ? "border-slate-900 ring-1 ring-slate-900/10 shadow-xs"
              : "border-slate-200/90"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
              1. Analyze Chart
            </span>
            <span>{formatDuration(totalAnalysisSeconds)} total</span>
          </div>

          <div className="flex items-baseline justify-between my-2">
            <div className="font-mono text-2xl font-bold text-slate-900">
              {formatDuration(timePerAssetSeconds)}
              <span className="text-xs font-normal text-slate-400 font-sans ml-1.5">
                / asset
              </span>
            </div>

            {currentAnalyzingSymbol && activePhase === "ANALYSIS" && (
              <div className="text-right font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded">
                <span className="font-bold">{currentAnalyzingSymbol}:</span>{" "}
                {formatDuration(cardRemainingSeconds)}
              </div>
            )}
          </div>

          {/* Two Progress Bars */}
          <div className="mt-3 space-y-2.5">
            {/* 1. Overall Assets Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Assets Progress ({completedCount}/{totalEligibleCount} done)</span>
                <span className="font-mono font-medium text-slate-700">{progressPercentage}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-800 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* 2. Current Asset Countdown Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>
                  Current Asset {currentAnalyzingSymbol ? `(${currentAnalyzingSymbol})` : "(Idle)"}
                </span>
                <span className="font-mono font-medium text-slate-700">
                  {currentAnalyzingSymbol ? `${currentAssetProgress}%` : "0%"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    isCardTimerRunning ? "bg-indigo-600" : "bg-slate-400"
                  }`}
                  style={{ width: `${currentAnalyzingSymbol ? currentAssetProgress : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2.5 mt-2.5 border-t border-slate-100">
            <span>Open positions excluded</span>
            {activePhase === "ANALYSIS" && (
              <button
                type="button"
                onClick={handleStartExecution}
                className="text-slate-700 hover:text-slate-900 font-medium underline cursor-pointer"
              >
                Go to Execution →
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Execution */}
        <div
          className={`rounded-xl border p-4 bg-white transition-all ${
            activePhase === "EXECUTION"
              ? "border-slate-900 ring-1 ring-slate-900/10 shadow-xs"
              : "border-slate-200/90"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
              2. Execution
            </span>
            <span>{formatDuration(totalExecutionSeconds)} total</span>
          </div>

          <div className="flex items-baseline justify-between my-2">
            <div className="font-mono text-2xl font-bold text-slate-900">
              {formatDuration(executionRemaining)}
            </div>

            {activePhase !== "EXECUTION" && activePhase !== "FINISHED" ? (
              <button
                type="button"
                onClick={handleStartExecution}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
              >
                Start Execution
              </button>
            ) : activePhase === "EXECUTION" ? (
              <button
                type="button"
                onClick={handleToggleExecutionTimer}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium cursor-pointer"
              >
                {isExecutionRunning ? "Pause" : "Resume"}
              </button>
            ) : (
              <span className="text-xs text-slate-500 font-medium">
                Done
              </span>
            )}
          </div>

          {/* Execution Progress Bar */}
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>
                {activePhase === "EXECUTION"
                  ? isExecutionRunning
                    ? "Execution Active"
                    : "Execution Paused"
                  : activePhase === "FINISHED"
                  ? "Execution Finished"
                  : "Execution Ready"}
              </span>
              <span className="font-mono font-medium text-slate-700">
                {executionProgress}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  activePhase === "FINISHED"
                    ? "bg-emerald-600"
                    : isExecutionRunning
                    ? "bg-slate-900"
                    : "bg-slate-400"
                }`}
                style={{ width: `${executionProgress}%` }}
              />
            </div>
          </div>

          <div className="text-xs text-slate-400 pt-2.5 mt-2.5 border-t border-slate-100">
            Execute trades on green-flagged assets
          </div>
        </div>
      </div>

      {/* Warning */}
      {error && (
        <div className="border border-slate-200 bg-slate-50 rounded-lg p-2.5 text-xs text-slate-600 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
          <span>MT5 server warning: {error}</span>
        </div>
      )}

      {/* Assets Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">
          Loading assets...
        </div>
      ) : trackedAssets.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
          No tracked assets found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {assetsWithPositionInfo.map((asset) => {
            const hasPos = asset.hasPosition;
            const isCurrentlyAnalyzing =
              currentAnalyzingSymbol === asset.symbol && activePhase === "ANALYSIS";
            const isFulfilled = analyzedSymbols.has(asset.symbol);
            const mark = dailyMarks[asset.symbol] || null;
            const chartUrl = getChartUrl(asset);

            return (
              <div
                key={asset.symbol}
                className={`bg-white rounded-lg border p-3 flex flex-col justify-between transition-all ${
                  isCurrentlyAnalyzing
                    ? "border-slate-900 shadow-xs ring-1 ring-slate-900/10"
                    : mark === "GREEN_ZONE"
                    ? "border-emerald-400 bg-emerald-50/20"
                    : mark === "NO_SETUP"
                    ? "border-slate-200 opacity-60"
                    : "border-slate-200/90"
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-sm text-slate-900">
                        {asset.symbol}
                      </span>
                      {mark === "GREEN_ZONE" && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                          Green
                        </span>
                      )}
                      {mark === "NO_SETUP" && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                          Skip
                        </span>
                      )}
                    </div>

                    {hasPos ? (
                      <span className="text-[10px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        Open ({asset.positionCount})
                      </span>
                    ) : isFulfilled ? (
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    ) : null}
                  </div>

                  {/* Open Chart */}
                  <div className="mt-2">
                    <a
                      href={chartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-1 px-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                      <span>Open Chart</span>
                    </a>
                  </div>

                  {/* Actions / Timers */}
                  {!hasPos ? (
                    <div className="mt-2 p-2 bg-slate-50 rounded border border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px]">
                          {isCurrentlyAnalyzing ? "Analyzing" : "Time"}
                        </span>
                        <span className="font-mono font-semibold text-slate-800 text-xs">
                          {isCurrentlyAnalyzing
                            ? formatDuration(cardRemainingSeconds)
                            : formatDuration(timePerAssetSeconds)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 pt-1 border-t border-slate-200/60">
                        {!isCurrentlyAnalyzing ? (
                          <button
                            type="button"
                            onClick={() => handleStartCardAnalysis(asset.symbol)}
                            className="w-full py-1 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                          >
                            {isFulfilled ? "Re-Analyze" : "Start"}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={handleToggleCardTimer}
                              className="flex-1 py-1 text-xs font-medium rounded bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer"
                            >
                              {isCardTimerRunning ? "Pause" : "Play"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFinishCurrentAsset(asset.symbol)}
                              className="flex-1 py-1 text-xs font-medium rounded bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                            >
                              Next
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-1.5 rounded bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500">
                      Skipped (Open position)
                    </div>
                  )}

                  {/* Tag Buttons: Green Zone vs No Setup */}
                  <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSetMark(asset.symbol, "GREEN_ZONE")}
                      className={`py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                        mark === "GREEN_ZONE"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Green Zone
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetMark(asset.symbol, "NO_SETUP")}
                      className={`py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                        mark === "NO_SETUP"
                          ? "bg-slate-800 text-white border-slate-800"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      No Setup
                    </button>
                  </div>
                </div>

                {/* Open Positions Info if any */}
                {hasPos && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-mono space-y-0.5">
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Lots: {asset.totalLots.toFixed(2)}</span>
                      <span
                        className={
                          asset.totalProfit >= 0
                            ? "text-emerald-600 font-semibold"
                            : "text-rose-600 font-semibold"
                        }
                      >
                        {currencyPrefix}
                        {asset.totalProfit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
