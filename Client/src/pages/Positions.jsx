import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  Search,
  PieChart,
  Activity,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  BellRing,
  TrendingUp,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";
import TradeModal from "@/components/trade/TradeModal";

export default function Positions() {
  const { data: response, loading, error } = usePolling(API.positions, 2000);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, PROFIT, DRAWDOWN, ALERT
  const [selectedAssetForTrade, setSelectedAssetForTrade] = useState(null);

  const data = response?.data;
  const account = data?.account;
  const summary = data?.summary;
  const positions = useMemo(() => data?.positions || [], [data?.positions]);

  const isCent = account?.is_cent ?? account?.currency === "USC";
  const currencyUnit = isCent ? "USC" : "USD";
  const currencyPrefix = isCent ? "¢" : "$";
  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 120.0;

  // Global default alert cap derived by account type (100 USC or 1.0 USD)
  const [customDefaultCap, setCustomDefaultCap] = useState(null);
  const [defaultCapDraft, setDefaultCapDraft] = useState("");

  const defaultCap = customDefaultCap ?? (isCent ? 100 : 1.0);
  const displayDefaultCapDraft =
    defaultCapDraft !== "" ? defaultCapDraft : String(defaultCap);

  // Persisted caps by ticket: { [ticket]: number }
  const [alertCaps, setAlertCaps] = useState(() => {
    try {
      const saved = localStorage.getItem("lyquant_asset_alert_caps_v2");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Local input drafts so user can freely backspace, delete, and type without snapback
  const [inputDrafts, setInputDrafts] = useState({});

  // Save to localStorage when alertCaps change
  useEffect(() => {
    try {
      localStorage.setItem(
        "lyquant_asset_alert_caps_v2",
        JSON.stringify(alertCaps),
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [alertCaps]);

  // Global summary values
  const totalProfitAcc = summary?.total_profit ?? 0;
  const totalProfitUSD =
    summary?.total_profit_usd ??
    (isCent ? totalProfitAcc / 100 : totalProfitAcc);
  const totalProfitBDT = totalProfitUSD * bdtRate;

  const marginUSD = isCent
    ? (account?.margin ?? 0) / 100
    : (account?.margin ?? 0);
  const marginBDT = marginUSD * bdtRate;
  const marginLevel = account?.margin_level ?? 0;

  const totalVolUSD = summary?.total_volume_usd ?? 0;
  const totalVolBDT = totalVolUSD * bdtRate;
  const totalLots = summary?.total_lots ?? 0;

  // Helper to commit position cap on blur or Enter
  const commitPositionCap = useCallback(
    (ticket, rawVal) => {
      const num = parseFloat(rawVal);
      const fallback = isCent ? 100 : 1.0;
      const finalVal = !isNaN(num) && num > 0 ? num : fallback;

      setAlertCaps((prev) => ({
        ...prev,
        [ticket]: finalVal,
      }));
      setInputDrafts((prev) => ({
        ...prev,
        [ticket]: String(finalVal),
      }));
    },
    [isCent],
  );

  // Sync newly executed trade alert cap
  const handleTradeSuccess = useCallback((tradeData) => {
    if (tradeData?.ticket && tradeData?.cap) {
      setAlertCaps((prev) => ({
        ...prev,
        [tradeData.ticket]: tradeData.cap,
      }));
    }
  }, []);

  // Compute calculated metrics for each position
  const enrichedPositions = useMemo(() => {
    return positions.map((pos) => {
      // Determine effective cap in account currency (USC or USD)
      const draftVal = inputDrafts[pos.ticket];
      const savedVal = alertCaps[pos.ticket];
      const fallbackVal = defaultCap;

      let effectiveCap = fallbackVal;
      if (draftVal !== undefined) {
        const parsedDraft = parseFloat(draftVal);
        if (!isNaN(parsedDraft) && parsedDraft > 0) {
          effectiveCap = parsedDraft;
        }
      } else if (savedVal !== undefined && savedVal > 0) {
        effectiveCap = savedVal;
      }

      // Base volume in account currency:
      // For cent account, 1 USD = 100 USC
      const baseVolUSD = pos.volume_usd || 0;
      const baseVolAcc = isCent ? baseVolUSD * 100 : baseVolUSD;
      const baseVolBDT = baseVolUSD * bdtRate;

      // PnL in account currency and USD
      const pnlAcc = pos.profit || 0;
      const pnlUSD = pos.profit_usd ?? (isCent ? pnlAcc / 100 : pnlAcc);
      const pnlBDT = pnlUSD * bdtRate;

      // 1. Cap % of Base Volume (both in account currency)
      // e.g., 100 USC on 1340 USC = 7.46%
      const capPercentOfBase =
        baseVolAcc > 0 ? (effectiveCap / baseVolAcc) * 100 : 0;

      // 2. Real PnL % of Base Volume
      const realPnlPercentOfBase =
        baseVolAcc > 0 ? (pnlAcc / baseVolAcc) * 100 : 0;

      // 3. Drawdown usage against Cap:
      // When in loss (pnlAcc < 0), how much of the cap is consumed?
      const lossAcc = pnlAcc < 0 ? Math.abs(pnlAcc) : 0;
      const capUsagePercent =
        effectiveCap > 0 ? (lossAcc / effectiveCap) * 100 : 0;

      // Status determination
      let status = "SAFE";
      if (pnlAcc >= 0) {
        status = "PROFIT";
      } else if (capUsagePercent >= 100) {
        status = "ALERT_HIT";
      } else if (capUsagePercent >= 75) {
        status = "APPROACHING";
      } else {
        status = "NORMAL_DRAWDOWN";
      }

      return {
        ...pos,
        effectiveCap,
        baseVolAcc,
        baseVolUSD,
        baseVolBDT,
        pnlAcc,
        pnlUSD,
        pnlBDT,
        capPercentOfBase,
        realPnlPercentOfBase,
        capUsagePercent,
        status,
      };
    });
  }, [positions, inputDrafts, alertCaps, defaultCap, isCent, bdtRate]);

  // Filter positions
  const filteredPositions = useMemo(() => {
    return enrichedPositions.filter((pos) => {
      // Search match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        pos.symbol?.toLowerCase().includes(q) ||
        String(pos.ticket).includes(q) ||
        pos.type?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === "PROFIT") return pos.pnlAcc >= 0;
      if (statusFilter === "DRAWDOWN") return pos.pnlAcc < 0;
      if (statusFilter === "ALERT") return pos.status === "ALERT_HIT";

      return true;
    });
  }, [enrichedPositions, searchQuery, statusFilter]);

  // Total alert count
  const alertCount = useMemo(() => {
    return enrichedPositions.filter((p) => p.status === "ALERT_HIT").length;
  }, [enrichedPositions]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Position Volumes & Asset Drawdown Alerts
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {positions.length} Active Positions
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
              {currencyUnit} Account
            </span>
            {alertCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse flex items-center gap-1">
                <BellRing className="w-3 h-3" />
                {alertCount} Cap Hit!
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual CFD asset exposure, live profit/loss, and per-position
            drawdown alert monitoring in {currencyUnit}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/my-assets"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Trade Watchlist</span>
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh Live Data</span>
          </button>
        </div>
      </div>

      {/* Backend / MT5 Error banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>
            <strong>Connection Warning:</strong> Unable to connect to MT5 server
            ({error}). Ensure the MetaTrader 5 terminal is open and logged in.
          </span>
        </div>
      )}

      {/* Top Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Floating P&L */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Total Floating P&L</span>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                totalProfitAcc >= 0
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-rose-500 animate-pulse"
              }`}
            />
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              totalProfitAcc >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {totalProfitAcc >= 0 ? "+" : ""}
            {totalProfitAcc.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {currencyUnit}
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>
              USD:{" "}
              <strong
                className={
                  totalProfitUSD >= 0 ? "text-emerald-700" : "text-rose-600"
                }
              >
                {totalProfitUSD >= 0 ? "+$" : "-$"}
                {Math.abs(totalProfitUSD).toFixed(2)}
              </strong>
            </span>
            <span className="text-indigo-600 font-semibold">
              BDT: ৳{Math.abs(totalProfitBDT).toFixed(0)}
            </span>
          </div>
        </div>

        {/* Total Exposure & Volume */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Total CFD Exposure</span>
            <Flame className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-900">
            ${totalVolUSD.toFixed(2)}{" "}
            <span className="text-xs text-slate-400 font-normal">USD</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>
              Lots:{" "}
              <strong className="text-slate-800">{totalLots.toFixed(2)}</strong>
            </span>
            <span className="text-indigo-600 font-semibold">
              ৳
              {totalVolBDT.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        {/* Margin Used & Level */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Margin Level</span>
            <PieChart className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              marginLevel > 200
                ? "text-emerald-600"
                : marginLevel > 100
                  ? "text-amber-600"
                  : "text-rose-600"
            }`}
          >
            {marginLevel.toFixed(1)}%
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>Margin: ${marginUSD.toFixed(2)} USD</span>
            <span className="text-slate-600 font-semibold">
              ৳{marginBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Alert Summary Box */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Drawdown Alerts</span>
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              alertCount > 0 ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {alertCount > 0 ? `${alertCount} Triggered` : "All Safe"}
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>
              Default Cap: {defaultCap} {currencyUnit}
            </span>
            <span
              className={
                alertCount > 0
                  ? "text-rose-600 font-bold"
                  : "text-emerald-600 font-semibold"
              }
            >
              {alertCount > 0 ? "Action Needed" : "Within Limits"}
            </span>
          </div>
        </div>
      </div>

      {/* Controls: Search, Status Filter, and Default Cap Setter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ticket or symbol..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600 overflow-x-auto w-full md:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-white text-slate-900 font-semibold shadow-xs"
                : "hover:text-slate-900"
            }`}
          >
            All ({enrichedPositions.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PROFIT")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              statusFilter === "PROFIT"
                ? "bg-white text-emerald-700 font-semibold shadow-xs"
                : "hover:text-emerald-700"
            }`}
          >
            In Profit ({enrichedPositions.filter((p) => p.pnlAcc >= 0).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("DRAWDOWN")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              statusFilter === "DRAWDOWN"
                ? "bg-white text-rose-700 font-semibold shadow-xs"
                : "hover:text-rose-700"
            }`}
          >
            In Drawdown ({enrichedPositions.filter((p) => p.pnlAcc < 0).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ALERT")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              statusFilter === "ALERT"
                ? "bg-rose-600 text-white font-semibold shadow-xs"
                : "hover:text-rose-600"
            }`}
          >
            Cap Hit ({alertCount})
          </button>
        </div>

        {/* Global Default Cap Quick Control in Account Currency */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 w-full md:w-auto justify-end">
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Default Cap:
          </span>
          <div className="relative w-28">
            <input
              type="text"
              inputMode="decimal"
              value={displayDefaultCapDraft}
              onChange={(e) => {
                const val = e.target.value;
                setDefaultCapDraft(val);
                const num = parseFloat(val);
                if (!isNaN(num) && num > 0) {
                  setCustomDefaultCap(num);
                }
              }}
              onBlur={() => {
                const num = parseFloat(displayDefaultCapDraft);
                const fallback = isCent ? 100 : 1.0;
                const finalVal = !isNaN(num) && num > 0 ? num : fallback;
                setCustomDefaultCap(finalVal);
                setDefaultCapDraft(String(finalVal));
              }}
              className="w-full pl-3 pr-10 py-1 text-xs font-bold font-mono bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
              {currencyUnit}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Position Cards (No Table) */}
      {loading && positions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">
              Loading active CFD positions from MT5...
            </span>
          </div>
        </div>
      ) : filteredPositions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <Activity className="w-8 h-8 text-slate-300" />
            <span className="text-sm font-medium text-slate-600">
              {positions.length === 0
                ? "No active open positions in your MT5 terminal."
                : "No positions match the current filters."}
            </span>
            {positions.length === 0 && (
              <Link
                to="/my-assets"
                className="mt-3 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Open Position from Watchlist</span>
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPositions.map((pos) => {
            const isAlertHit = pos.status === "ALERT_HIT";
            const isApproaching = pos.status === "APPROACHING";
            const isProfit = pos.pnlAcc >= 0;

            // Border & Card Accent
            const cardBorderClass = isAlertHit
              ? "border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10"
              : isApproaching
                ? "border-amber-300 ring-1 ring-amber-500/20"
                : "border-slate-200/80";

            // Value currently displayed in input (allows seamless typing/backspace)
            const draftInputVal =
              inputDrafts[pos.ticket] !== undefined
                ? inputDrafts[pos.ticket]
                : String(alertCaps[pos.ticket] ?? defaultCap);

            return (
              <div
                key={pos.ticket}
                className={`bg-white rounded-xl border ${cardBorderClass} p-5 shadow-xs transition-all flex flex-col justify-between space-y-4`}
              >
                {/* 1. Header: Symbol, Type, Ticket, Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold font-mono text-slate-900 tracking-tight">
                        {pos.symbol}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pos.type === "BUY"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {pos.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      #{pos.ticket} • {pos.time}
                    </div>
                  </div>

                  {/* Dynamic Status Badge & Quick Trade */}
                  <div className="flex items-center gap-2">
                    {isAlertHit ? (
                      <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-rose-600 text-white flex items-center gap-1 shadow-xs animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        Cap Hit
                      </span>
                    ) : isApproaching ? (
                      <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Near Cap
                      </span>
                    ) : isProfit ? (
                      <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 flex items-center gap-1 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        In Profit
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        Safe
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Base Notional Volume & Lot Info */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50/80 rounded-lg border border-slate-100 text-center font-mono">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">
                      Lot Size
                    </div>
                    <div className="text-xs font-bold text-slate-800 mt-0.5">
                      {pos.volume.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">
                      Base Vol ({currencyUnit})
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {isCent
                        ? `${pos.baseVolAcc.toLocaleString("en-US", { maximumFractionDigits: 0 })} USC`
                        : `$${pos.baseVolUSD.toFixed(2)}`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">
                      Base Vol (BDT)
                    </div>
                    <div className="text-xs font-bold text-indigo-600 mt-0.5">
                      ৳
                      {pos.baseVolBDT.toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Market Prices & Order Info */}
                <div className="flex items-center justify-between text-xs font-mono px-1">
                  <div>
                    <span className="text-slate-400 text-[11px]">Open: </span>
                    <strong className="text-slate-800">
                      {pos.price_open.toFixed(5)}
                    </strong>
                  </div>
                  <div className="text-slate-300">→</div>
                  <div>
                    <span className="text-slate-400 text-[11px]">
                      Current:{" "}
                    </span>
                    <strong className="text-slate-900">
                      {pos.price_current.toFixed(5)}
                    </strong>
                  </div>
                </div>

                {/* 4. Live Floating P&L Section */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    isProfit
                      ? "bg-emerald-50/50 border-emerald-200/80"
                      : "bg-rose-50/50 border-rose-200/80"
                  } space-y-1.5`}
                >
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    <span>Live Floating P&L</span>
                    <span
                      className={`font-mono font-bold flex items-center gap-0.5 ${
                        isProfit ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {isProfit ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {pos.realPnlPercentOfBase >= 0 ? "+" : ""}
                      {pos.realPnlPercentOfBase.toFixed(2)}% of Volume
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between font-mono">
                    <span
                      className={`text-xl font-bold ${
                        isProfit ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {pos.pnlAcc >= 0 ? "+" : ""}
                      {pos.pnlAcc.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs font-medium">
                        {currencyUnit}
                      </span>
                    </span>

                    <div className="text-right text-xs">
                      <div
                        className={`font-bold ${
                          isProfit ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {pos.pnlUSD >= 0 ? "+$" : "-$"}
                        {Math.abs(pos.pnlUSD).toFixed(2)} USD
                      </div>
                      <div className="text-indigo-600 font-semibold text-[11px]">
                        {pos.pnlBDT >= 0 ? "+৳" : "-৳"}
                        {Math.abs(pos.pnlBDT).toFixed(0)} BDT
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Max Drawdown Alert Cap Controller & Progress Gauge */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                      Drawdown Alert Cap ({currencyUnit})
                    </span>

                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      Native {currencyUnit}
                    </span>
                  </div>

                  {/* Cap Input & Math breakdown */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-semibold">
                        {currencyPrefix}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draftInputVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInputDrafts((prev) => ({
                            ...prev,
                            [pos.ticket]: val,
                          }));
                          const num = parseFloat(val);
                          if (!isNaN(num) && num > 0) {
                            setAlertCaps((prev) => ({
                              ...prev,
                              [pos.ticket]: num,
                            }));
                          }
                        }}
                        onBlur={() =>
                          commitPositionCap(pos.ticket, draftInputVal)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitPositionCap(pos.ticket, draftInputVal);
                            e.target.blur();
                          }
                        }}
                        placeholder={isCent ? "100" : "1.00"}
                        className="w-full pl-6 pr-10 py-1.5 text-xs font-bold font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-slate-400">
                        {currencyUnit}
                      </span>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-[10px] text-slate-400 uppercase font-medium">
                        Cap Threshold
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        {pos.capPercentOfBase.toFixed(2)}% of Vol
                      </div>
                    </div>
                  </div>

                  {/* Drawdown Progress Gauge Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400">
                        Cap Used:{" "}
                        <strong
                          className={
                            isAlertHit
                              ? "text-rose-600"
                              : isApproaching
                                ? "text-amber-600"
                                : "text-slate-700"
                          }
                        >
                          {pos.capUsagePercent.toFixed(1)}%
                        </strong>
                      </span>
                      <span className="text-slate-500">
                        {pos.pnlAcc < 0
                          ? `-${Math.abs(pos.pnlAcc).toFixed(2)} / -${pos.effectiveCap} ${currencyUnit}`
                          : "No Loss Active"}
                      </span>
                    </div>

                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          isAlertHit
                            ? "bg-rose-600 animate-pulse"
                            : isApproaching
                              ? "bg-amber-500"
                              : isProfit
                                ? "bg-emerald-500"
                                : "bg-indigo-500"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(isProfit ? 0 : 2, pos.capUsagePercent))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Banner if Alert is Triggered */}
                  {isAlertHit && (
                    <div className="bg-rose-100/90 border border-rose-300 rounded-md p-2 text-center text-[11px] font-bold text-rose-800 animate-pulse flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>REBALANCE PORTFOLIO — CAP HIT!</span>
                    </div>
                  )}
                </div>

                {/* 6. Action Footer: Open Trade */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    Order #{pos.ticket} • {pos.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Open Position Trade Modal */}
      {selectedAssetForTrade && (
        <TradeModal
          key={selectedAssetForTrade.symbol}
          isOpen={true}
          asset={selectedAssetForTrade}
          isCent={isCent}
          onClose={() => setSelectedAssetForTrade(null)}
          onSuccess={handleTradeSuccess}
        />
      )}
    </div>
  );
}
