import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  Activity,
  Sliders,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trash2,
  LineChart,
  CheckCircle2,
  Target,
  Layers,
  PlusCircle,
  XCircle,
  Clock,
  Gauge,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";

export default function RiskManagement() {
  const { data: response, loading, error, refresh } = usePolling(API.risk.overview, 2000);

  const engineData = response?.data;
  const config = engineData?.config;
  const balance = Number(engineData?.balance ?? 2000);
  const history = engineData?.history || [];
  const openTrades = engineData?.open_trades || [];
  const tier = engineData?.tier || {};
  const tierState = engineData?.tier_state || {};

  // Local config form state for the Master Configuration Panel
  const [localConfig, setLocalConfig] = useState(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isExecutingTrade, setIsExecutingTrade] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isOpeningTrade, setIsOpeningTrade] = useState(false);
  const [isClosingOpenTradeId, setIsClosingOpenTradeId] = useState(null);

  // Trading parameters
  const [winRateInput, setWinRateInput] = useState(50);
  const [rrInput, setRrInput] = useState(1.5);
  const [exactToggle, setExactToggle] = useState(false);
  const [exactPnlInput, setExactPnlInput] = useState("");
  const [exactRiskInput, setExactRiskInput] = useState("");

  // Sync loaded config to form
  useEffect(() => {
    if (config && !localConfig) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
      setWinRateInput(config.winRate ?? 50);
      setRrInput(config.rrRatio ?? 1.5);
    }
  }, [config, localConfig]);

  const terminalHalted =
    config && (balance <= Number(config.terminalFloor) || balance >= Number(config.profitTarget));
  const isFloorReached = config && balance <= Number(config.terminalFloor);
  const isTargetReached = config && balance >= Number(config.profitTarget);

  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Submit Trade (WIN or LOSS) - directly or resolving an open trade with custom PnL
  const handleMakeTrade = async (isWin, targetOpenId = null) => {
    if (terminalHalted) return;

    let pnlAmount = null;
    if (targetOpenId) {
      // Prompt user for the exact profit or loss amount if they want to specify, or default
      const promptMsg = isWin
        ? "Enter Profit amount ($):"
        : "Enter Loss amount ($):";
      const defaultVal = exactPnlInput || "";
      const userInput = window.prompt(promptMsg, defaultVal);
      if (userInput === null) return; // User cancelled prompt
      const parsed = parseFloat(userInput);
      if (!isNaN(parsed) && parsed > 0) {
        pnlAmount = parsed;
      }
      setIsClosingOpenTradeId(targetOpenId);
    } else {
      const pnlVal = parseFloat(exactPnlInput);
      if (!isNaN(pnlVal) && pnlVal > 0) {
        pnlAmount = pnlVal;
      }
      setIsExecutingTrade(true);
    }

    try {
      const res = await fetch(API.risk.trade, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isWin,
          rrRatio: parseFloat(rrInput) || 1.5,
          exactEnabled: pnlAmount !== null,
          exactPnl: pnlAmount !== null ? pnlAmount : 0,
          openTradeId: targetOpenId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(
          isWin ? "Trade resolved: WIN (Profit Added)" : "Trade resolved: LOSS (Deducted)",
          isWin ? "success" : "error"
        );
        setExactPnlInput("");
        if (refresh) refresh();
      } else {
        showToast(json.error || json.message || "Trade execution failed", "error");
      }
    } catch {
      showToast("Error connecting to database engine.", "error");
    } finally {
      setIsExecutingTrade(false);
      setIsClosingOpenTradeId(null);
    }
  };

  // Open a new trade using the suggested tier risk or custom risk
  const handleOpenTrade = async () => {
    if (terminalHalted) return;
    setIsOpeningTrade(true);
    try {
      const customR = parseFloat(exactRiskInput);
      const res = await fetch(API.risk.openTrade, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          risk: !isNaN(customR) && customR > 0 ? customR : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Open trade registered in engine!");
        setExactRiskInput("");
        if (refresh) refresh();
      } else {
        showToast(json.error || "Failed to open trade.", "error");
      }
    } catch {
      showToast("Error registering open trade.", "error");
    } finally {
      setIsOpeningTrade(false);
    }
  };

  // Cancel an open trade without PnL
  const handleCancelOpenTrade = async (openTradeId) => {
    try {
      const res = await fetch(API.risk.cancelOpen, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: openTradeId }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Open trade cancelled.");
        if (refresh) refresh();
      } else {
        showToast(json.error || "Failed to cancel open trade.", "error");
      }
    } catch {
      showToast("Error cancelling open trade.", "error");
    }
  };

  // Make Random Trade based on Win Rate %
  const handleMakeRandomTrade = () => {
    const rate = parseFloat(winRateInput) || 50;
    const isWin = Math.random() * 100 < rate;
    handleMakeTrade(isWin);
  };

  // Reset Database
  const handleResetDatabase = async () => {
    if (!window.confirm("Are you sure you want to reset the database and restore starting balance?"))
      return;
    setIsResetting(true);
    try {
      const res = await fetch(API.risk.reset, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        showToast("Database successfully reset.");
        if (refresh) refresh();
      }
    } catch {
      showToast("Failed to reset database.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  // Delete Individual Trade
  const handleDeleteTrade = async (id) => {
    if (!window.confirm("Delete this trade and recalculate the balance curve?")) return;
    try {
      const res = await fetch(API.risk.deleteTrade, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Trade deleted and balance recalculated.");
        if (refresh) refresh();
      }
    } catch {
      showToast("Failed to delete trade.", "error");
    }
  };

  // Save Master Configuration
  const handleSaveConfig = async () => {
    if (!localConfig) return;
    setIsSavingConfig(true);
    try {
      const payloadConfig = {
        ...localConfig,
        winRate: parseFloat(winRateInput) || 50,
        rrRatio: parseFloat(rrInput) || 1.5,
      };
      const res = await fetch(API.risk.config, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: payloadConfig }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Configuration updated. Trade history reset.");
        setShowConfigPanel(false);
        if (refresh) refresh();
      }
    } catch {
      showToast("Failed to update configuration.", "error");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const currentRisk = tier?.risk ?? 20;
  const calculatedReward = (currentRisk * (parseFloat(rrInput) || 1.5)).toFixed(2);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl border text-xs font-mono shadow-xl transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              <span>Risk Management & Execution Simulator</span>
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                terminalHalted
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  terminalHalted ? "bg-rose-500" : "bg-emerald-500 animate-pulse"
                }`}
              />
              {terminalHalted ? "Halted / Suspended" : "Engine Standby"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-tier capital scaling engine: mathematical downside defense, profit step progression, and database simulation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/charts"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Charts Hub</span>
          </Link>
          <button
            type="button"
            disabled={isResetting}
            onClick={handleResetDatabase}
            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isResetting ? "Resetting..." : "Reset DB"}</span>
          </button>
          <button
            type="button"
            onClick={() => refresh && refresh()}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs transition-colors shadow-xs cursor-pointer"
            title="Refresh engine state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Halt Banners */}
      {isFloorReached && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center gap-3 text-rose-800 text-xs font-mono shadow-2xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>
            <strong>CRITICAL FLOOR REACHED:</strong> Balance (${balance.toFixed(2)}) reached Terminal Floor (${config.terminalFloor}). Trading suspended.
          </span>
        </div>
      )}
      {isTargetReached && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 text-emerald-800 text-xs font-mono shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>
            <strong>PROFIT TARGET REACHED:</strong> Balance (${balance.toFixed(2)}) reached Target (${config.profitTarget}). Challenge target fulfilled.
          </span>
        </div>
      )}

      {/* Top 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Engine Balance */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
            Engine Balance
          </span>
          <div className="text-xl font-bold font-mono text-slate-900">
            ${balance.toFixed(2)}
          </div>
          <div className="text-xs font-medium text-slate-500 font-mono">
            Start: ${config?.startBalance || 2000}
          </div>
        </div>

        {/* 2. Active Mode & Tier */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
            Framework Tier
          </span>
          <div
            className={`text-xl font-bold tracking-tight ${
              tier.type === "profit"
                ? "text-emerald-600"
                : tier.type === "dd"
                ? "text-rose-600"
                : "text-slate-900"
            }`}
          >
            {tier.stepName || "Base"}
          </div>
          <div className="text-xs text-slate-500 font-mono">{tier.mode || "Base Balance"}</div>
        </div>

        {/* 3. Risk Per Trade */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
            Tier Risk / Reward Target
          </span>
          <div className="text-xl font-bold font-mono text-indigo-700">
            ${currentRisk.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ ${calculatedReward}</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">1:{rrInput} RR Setup</div>
        </div>

        {/* 4. Trades Logged */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1 bg-linear-to-br from-indigo-50/40 to-white">
          <span className="text-[10px] text-indigo-700 uppercase font-bold tracking-wider">
            Total History Trades
          </span>
          <div className="text-xl font-bold font-mono text-slate-900">{history.length}</div>
          <div className="text-xs text-slate-500 font-mono">
            {history.filter((h) => Number(h.is_win) === 1).length} Wins •{" "}
            {history.filter((h) => Number(h.is_win) === 0).length} Losses
          </div>
        </div>
      </div>

      {/* Row 1: Interactive Execution Dashboard & Profit Ladder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulator Dashboard & Risk Suggestion */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              <span>Risk Management Engine</span>
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Dynamic Risk Suggestion</span>
          </div>

          {/* Current Dynamic Risk Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Next Suggested Trade Risk
              </span>
              <div className="text-2xl font-bold font-mono text-indigo-600 mt-0.5">
                ${currentRisk.toFixed(2)}
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Suggested for {tierState?.suggestedStepName || tier?.stepName || "Step 1"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Tier Trade Capacity
              </span>
              <div className="text-sm font-bold font-mono text-slate-800 mt-1">
                {tierState?.trades_count ?? 0} / {tierState?.max_trades ?? 4} Trades
              </div>
              <span
                className={`text-[11px] font-mono font-medium ${
                  (tierState?.trades_count ?? 0) >= (tierState?.max_trades ?? 4)
                    ? "text-rose-600 font-bold"
                    : "text-emerald-600"
                }`}
              >
                {(tierState?.trades_count ?? 0) >= (tierState?.max_trades ?? 4)
                  ? "Tier capacity fulfilled!"
                  : `${(tierState?.max_trades ?? 4) - (tierState?.trades_count ?? 0)} trade(s) until next tier`}
              </span>
            </div>
          </div>

          {/* Manual Trade Input & Execution */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                Custom Risk ($)
              </label>
              <input
                type="number"
                step="0.5"
                value={exactRiskInput}
                onChange={(e) => setExactRiskInput(e.target.value)}
                placeholder={`Leave blank to use suggested: $${currentRisk.toFixed(2)}`}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {/* Open Trade Button */}
            <button
              type="button"
              disabled={terminalHalted || isOpeningTrade}
              onClick={handleOpenTrade}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wide transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {isOpeningTrade
                  ? "Opening Trade..."
                  : `Open Trade (${
                      exactRiskInput && parseFloat(exactRiskInput) > 0
                        ? `$${parseFloat(exactRiskInput).toFixed(2)} Custom Risk`
                        : `$${currentRisk.toFixed(2)} Suggested Risk`
                    })`}
              </span>
            </button>

            <button
              type="button"
              disabled={isResetting}
              onClick={handleResetDatabase}
              className="w-full py-2 px-3 rounded-lg bg-slate-50 hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Engine DB</span>
            </button>
          </div>
        </div>

        {/* Profit Scaling Ladder Display */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Profit Scaling Ladder</span>
            </h2>
            <span className="text-[10px] font-mono font-semibold text-emerald-600 uppercase">
              Upside Scaling
            </span>
          </div>

          <div className="border border-slate-200/80 rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Tier</th>
                  <th className="p-2.5">Balance Range</th>
                  <th className="p-2.5">Cushion</th>
                  <th className="p-2.5 text-right">Risk / Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {config?.profitTiers?.map((t, i) => {
                  const isActive = tier?.activeId === `profit-step-${i}`;
                  return (
                    <tr
                      key={i}
                      className={
                        isActive
                          ? "bg-emerald-50/80 border-l-4 border-emerald-500 font-bold"
                          : "hover:bg-slate-50/60"
                      }
                    >
                      <td className="p-2.5 text-slate-800">Step {i + 1}</td>
                      <td className="p-2.5 text-slate-600">${t.min} - ${t.max}</td>
                      <td className="p-2.5 text-slate-500">{t.cushion}</td>
                      <td className="p-2.5 text-right text-emerald-600 font-bold">
                        ${Number(t.risk).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 2: Active Open Floating Trades & Dynamic Cushion Depletion */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Active Open Trades & Floating Cushion Monitor
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {openTrades.length} Floating
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-500">
              Floating Risk:{" "}
              <strong className="text-rose-600">
                ${tierState?.total_open_risk ? tierState.total_open_risk.toFixed(2) : "0.00"}
              </strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">
              Simulated Bal:{" "}
              <strong className="text-slate-800">
                ${tierState?.effective_balance ? tierState.effective_balance.toFixed(2) : balance.toFixed(2)}
              </strong>
            </span>
          </div>
        </div>

        {/* Dynamic Tier Trade Capacity Monitor */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Active Tier:</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-white border border-slate-200 text-slate-900">
                {tier?.stepName || "Step 1"}
              </span>
              <span className="text-slate-400">
                (Risk: ${currentRisk.toFixed(2)} • Cushion: {config?.profitTiers?.[0]?.cushion || "+$80"})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-600">
                Tier Trades: <strong className="text-indigo-600">{tierState?.trades_count ?? 0}</strong> / {tierState?.max_trades ?? 4}
              </span>
            </div>
          </div>

          {/* Bar Gauge */}
          {(() => {
            const maxT = tierState?.max_trades || 4;
            const count = tierState?.trades_count || 0;
            const pct = Math.min(100, Math.max(0, (count / maxT) * 100));
            return (
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    pct >= 100
                      ? "bg-rose-500"
                      : pct >= 75
                      ? "bg-amber-500"
                      : "bg-indigo-600"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })()}

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
            <span>
              {(tierState?.trades_count ?? 0) >= (tierState?.max_trades ?? 4)
                ? "⚠️ Max trades reached for tier: Stepped to next tier risk."
                : `${(tierState?.max_trades ?? 4) - (tierState?.trades_count ?? 0)} more trade(s) allowed in this tier before stepping.`}
            </span>
            <span className="font-bold text-indigo-700">
              Next Trade Suggested Risk: ${currentRisk.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Floating Trades Table */}
        <div className="border border-slate-200/80 rounded-xl overflow-x-auto shadow-2xs">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-2.5">Open Ticket</th>
                <th className="p-2.5">Tier Step</th>
                <th className="p-2.5">Committed Risk</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Opened At</th>
                <th className="p-2.5 text-right">Resolve Outcome / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {openTrades.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-6 text-center text-slate-400 font-sans text-xs">
                    No active open trades. Click <strong>"Open Trade"</strong> above to commit a trade and track tier capacity.
                  </td>
                </tr>
              ) : (
                openTrades.map((ot) => {
                  const isClosing = isClosingOpenTradeId === ot.id;
                  return (
                    <tr key={ot.id} className="hover:bg-slate-50/70">
                      <td className="p-2.5 font-bold text-slate-800">#{ot.id}</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {ot.mode}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-rose-600">${Number(ot.risk).toFixed(2)}</td>
                      <td className="p-2.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          FLOATING
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-400 text-[11px]">{ot.created_at || "Just now"}</td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isClosing}
                            onClick={() => handleMakeTrade(true, ot.id)}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Resolve as Profit"
                          >
                            + Profit
                          </button>
                          <button
                            type="button"
                            disabled={isClosing}
                            onClick={() => handleMakeTrade(false, ot.id)}
                            className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] uppercase transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                            title="Resolve as Loss"
                          >
                            - Loss
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelOpenTrade(ot.id)}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Remove without PnL"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Drawdown Defense Ladder & Trade History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drawdown Framework Ladder Display */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <span>Drawdown Defense Ladder</span>
            </h2>
            <span className="text-[10px] font-mono font-semibold text-rose-600 uppercase">
              Capital Defense
            </span>
          </div>

          <div className="border border-slate-200/80 rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Tier</th>
                  <th className="p-2.5">Balance Range</th>
                  <th className="p-2.5">Cushion</th>
                  <th className="p-2.5 text-right">Risk / Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {config?.ddTiers?.map((t, i) => {
                  const isActive = tier?.activeId === `dd-step-${i}`;
                  return (
                    <tr
                      key={i}
                      className={
                        isActive
                          ? "bg-rose-50/80 border-l-4 border-rose-500 font-bold"
                          : "hover:bg-slate-50/60"
                      }
                    >
                      <td className="p-2.5 text-slate-800">Step {i + 1}</td>
                      <td className="p-2.5 text-slate-600">${t.max} - ${t.min}</td>
                      <td className="p-2.5 text-slate-500">{t.cushion}</td>
                      <td className="p-2.5 text-right text-rose-600 font-bold">
                        ${Number(t.risk).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trade History (Database Log) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <span>Trade History (Database)</span>
            </h2>
            <span className="text-[10px] font-mono text-slate-400">{history.length} logged</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-auto max-h-[300px] shadow-2xs">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Ticket / Symbol</th>
                  <th className="p-2.5">Mode</th>
                  <th className="p-2.5">Outcome</th>
                  <th className="p-2.5">Risk</th>
                  <th className="p-2.5">PnL</th>
                  <th className="p-2.5">Balance</th>
                  <th className="p-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-slate-400 font-sans">
                      No trades logged in database yet. Trades opened with Risk Engine Sync will record here upon closing.
                    </td>
                  </tr>
                ) : (
                  history.map((h, index) => {
                    const isWin = Number(h.is_win) === 1;
                    const pnl = Number(h.pnl);
                    const pnlText = `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`;
                    return (
                      <tr key={h.id} className="hover:bg-slate-50/70">
                        <td className="p-2.5 font-bold text-slate-800">#{history.length - index}</td>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800 block">
                            {h.ticket ? `#${h.ticket}` : "—"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {h.symbol || ""}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">{h.mode}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isWin ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {isWin ? "WIN" : "LOSS"}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700">${Number(h.risk).toFixed(2)}</td>
                        <td
                          className={`p-2.5 font-bold ${
                            pnl >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {pnlText}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          ${Number(h.new_balance).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTrade(h.id)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded transition-colors cursor-pointer"
                            title="Delete and recalculate balance curve"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Master Configuration Panel Accordion */}
      {localConfig && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="w-full px-5 py-3.5 bg-slate-50/80 hover:bg-slate-100 border-b border-slate-200 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Master Configuration Matrix
              </span>
            </div>
            {showConfigPanel ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {showConfigPanel && (
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                    Starting Balance ($)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={localConfig.startBalance}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, startBalance: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                    Profit Target ($)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={localConfig.profitTarget}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, profitTarget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                    Terminal Floor ($)
                  </label>
                  <input
                    type="number"
                    step="10"
                    value={localConfig.terminalFloor}
                    onChange={(e) =>
                      setLocalConfig({ ...localConfig, terminalFloor: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Profit Scaling Tiers Input */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase">Profit Scaling Tiers</h3>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                        <tr>
                          <th className="p-2">Step</th>
                          <th className="p-2">Min</th>
                          <th className="p-2">Max</th>
                          <th className="p-2">Cushion</th>
                          <th className="p-2">Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {localConfig.profitTiers.map((t, i) => (
                          <tr key={i}>
                            <td className="p-2 font-semibold">Step {i + 1}</td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={t.min}
                                onChange={(e) => {
                                  const updated = [...localConfig.profitTiers];
                                  updated[i].min = parseFloat(e.target.value) || 0;
                                  setLocalConfig({ ...localConfig, profitTiers: updated });
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={t.max}
                                onChange={(e) => {
                                  const updated = [...localConfig.profitTiers];
                                  updated[i].max = parseFloat(e.target.value) || 0;
                                  setLocalConfig({ ...localConfig, profitTiers: updated });
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={t.cushion}
                                onChange={(e) => {
                                  const updated = [...localConfig.profitTiers];
                                  updated[i].cushion = e.target.value;
                                  setLocalConfig({ ...localConfig, profitTiers: updated });
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.5"
                                value={t.risk}
                                onChange={(e) => {
                                  const updated = [...localConfig.profitTiers];
                                  updated[i].risk = parseFloat(e.target.value) || 0;
                                  setLocalConfig({ ...localConfig, profitTiers: updated });
                                }}
                                className="w-14 bg-slate-50 border border-slate-200 rounded p-1 text-xs font-bold text-emerald-600"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Drawdown Defense Tiers Input */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 uppercase">Drawdown Defense Tiers</h3>
                  <div className="border border-slate-200 rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                        <tr>
                          <th className="p-2">Step</th>
                          <th className="p-2">Max</th>
                          <th className="p-2">Min</th>
                          <th className="p-2">Cushion</th>
                          <th className="p-2">Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {localConfig.ddTiers.map((t, i) => (
                          <tr key={i}>
                            <td className="p-2 font-semibold">Step {i + 1}</td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={t.max}
                                onChange={(e) => {
                                  const updated = [...localConfig.ddTiers];
                                  updated[i].max = parseFloat(e.target.value) || 0;
                                  setLocalConfig({ ...localConfig, ddTiers: updated });
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={t.min}
                                onChange={(e) => {
                                  const updated = [...localConfig.ddTiers];
                                  updated[i].min = parseFloat(e.target.value) || 0;
                                  setLocalConfig({ ...localConfig, ddTiers: updated });
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={t.cushion}
                                onChange={(e) => {
                                  const updated = [...localConfig.ddTiers];
                                  updated[i].cushion = e.target.value;
                                  setLocalConfig({ ...localConfig, ddTiers: updated });
                                }}
                                className="w-16 bg-slate-50 border border-slate-200 rounded p-1 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.5"
                                value={t.risk}
                                onChange={(e) => {
                                  const updated = [...localConfig.ddTiers];
                                  updated[i].risk = parseFloat(e.target.value) || 0;
                                  setLocalConfig({ ...localConfig, ddTiers: updated });
                                }}
                                className="w-14 bg-slate-50 border border-slate-200 rounded p-1 text-xs font-bold text-rose-600"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg uppercase shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingConfig ? "Saving..." : "Save Config & Reset DB"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
