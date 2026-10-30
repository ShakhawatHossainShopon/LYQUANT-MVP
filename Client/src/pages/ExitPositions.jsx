import React, { useState, useMemo } from "react";
import {
  LogOut,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Percent,
  Scale,
  Award,
  Search,
  Zap,
  Activity,
  Layers,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

export default function ExitPositions() {
  // Live polling for active open positions (every 2s)
  const {
    data: positionsResponse,
    loading: positionsLoading,
    error: positionsError,
  } = usePolling(API.positions, 2000);

  // Live polling for completed trade history & metrics (every 5s)
  const {
    data: historyResponse,
    loading: historyLoading,
    error: historyError,
  } = usePolling(API.history, 5000);

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 120.0;

  // Active positions data
  const positionsData = positionsResponse?.data;
  const activePositions = useMemo(
    () => positionsData?.positions || [],
    [positionsData?.positions]
  );
  const account = positionsData?.account;
  const isCent = account?.is_cent ?? account?.currency === "USC";
  const currencyUnit = isCent ? "USC" : "USD";

  // History & Metrics data
  const historyData = historyResponse?.data;
  const metrics = historyData?.metrics || {};
  const closedTrades = useMemo(
    () => historyData?.trades || [],
    [historyData?.trades]
  );

  // Search & Filter state for History
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("ALL"); // ALL, WINS, LOSSES
  const [historySort, setHistorySort] = useState("recent"); // recent, highest_profit, lowest_profit

  // Exit actions state
  const [closingTickets, setClosingTickets] = useState({});
  const [confirmTicket, setConfirmTicket] = useState(null);
  const [isClosingAll, setIsClosingAll] = useState(false);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Close single position handler
  const handleClosePosition = async (ticket) => {
    setClosingTickets((prev) => ({ ...prev, [ticket]: true }));
    setConfirmTicket(null);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch(API.closePosition, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || "Failed to exit position");
      }

      setActionMessage({
        type: "success",
        text: `Position #${ticket} successfully closed on MT5 at price ${json.data?.price || ""}.`,
      });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setClosingTickets((prev) => ({ ...prev, [ticket]: false }));
    }
  };

  // Close all positions handler
  const handleCloseAll = async () => {
    setIsClosingAll(true);
    setConfirmCloseAll(false);
    setActionMessage(null);
    setActionError(null);

    try {
      const res = await fetch(API.closeAllPositions, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || "Failed to exit all positions");
      }

      setActionMessage({
        type: "success",
        text: `All ${json.data?.total || activePositions.length} active positions have been processed for closure.`,
      });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsClosingAll(false);
    }
  };

  // Filtered & Sorted Closed Trades
  const filteredTrades = useMemo(() => {
    return closedTrades
      .filter((trade) => {
        const q = historySearch.toLowerCase().trim();
        const matchesQuery =
          !q ||
          trade.symbol?.toLowerCase().includes(q) ||
          String(trade.position_id).includes(q) ||
          trade.type?.toLowerCase().includes(q);

        if (!matchesQuery) return false;

        if (historyFilter === "WINS") return trade.is_win;
        if (historyFilter === "LOSSES") return trade.is_loss;

        return true;
      })
      .sort((a, b) => {
        if (historySort === "highest_profit") return b.profit - a.profit;
        if (historySort === "lowest_profit") return a.profit - b.profit;
        return b.close_timestamp - a.close_timestamp; // default: recent
      });
  }, [closedTrades, historySearch, historyFilter, historySort]);

  // Derived metrics
  const winRate = metrics.win_rate ?? 0;
  const profitFactor = metrics.profit_factor ?? 0;
  const rrRatio = metrics.risk_reward_ratio ?? 0;

  const netProfitAcc = metrics.net_profit ?? 0;
  const netProfitUSD = metrics.net_profit_usd ?? (isCent ? netProfitAcc / 100 : netProfitAcc);
  const netProfitBDT = netProfitUSD * bdtRate;

  const grossProfitUSD = metrics.gross_profit_usd ?? 0;
  const grossLossUSD = metrics.gross_loss_usd ?? 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Exit Positions & Trading History
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 font-mono">
              <LogOut className="w-3 h-3 text-rose-500" />
              {activePositions.length} Active to Exit
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {metrics.total_trades || 0} Historical Trades
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Instantly exit current open positions, review closed deal history,
            and monitor quantitative performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activePositions.length > 0 && (
            <>
              {confirmCloseAll ? (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <button
                    type="button"
                    disabled={isClosingAll}
                    onClick={handleCloseAll}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isClosingAll ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>Confirm Exit All ({activePositions.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCloseAll(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCloseAll(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Exit All Positions</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Action Messages / Error alerts */}
      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-emerald-800 text-xs font-mono animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {(actionError || positionsError || historyError) && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between text-rose-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError || positionsError || historyError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-800 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Quantitative Performance Metrics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Win Rate */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Win Rate</span>
            <Percent className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                winRate >= 50
                  ? "text-emerald-600"
                  : winRate >= 40
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({metrics.winning_trades || 0}W / {metrics.losing_trades || 0}L)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                winRate >= 50 ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, winRate))}%` }}
            />
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>Breakeven: {metrics.breakeven_trades || 0}</span>
            <span>Total: {metrics.total_trades || 0} Trades</span>
          </div>
        </div>

        {/* 2. Profit Factor */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Profit Factor</span>
            <Scale className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                profitFactor >= 1.5
                  ? "text-emerald-600"
                  : profitFactor >= 1.0
                  ? "text-slate-800"
                  : "text-rose-600"
              }`}
            >
              {profitFactor.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400">
              {profitFactor >= 1.5
                ? "Strong"
                : profitFactor >= 1.0
                ? "Profitable"
                : "Drawdown"}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span className="text-emerald-600">
              Gross Win: ${grossProfitUSD.toFixed(2)}
            </span>
            <span className="text-rose-600">
              Loss: -${grossLossUSD.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 3. Risk to Reward Ratio */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Risk : Reward Ratio</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              1 : {rrRatio.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (Avg Win / Loss)
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>Avg Win: ${metrics.avg_win_usd?.toFixed(2) || "0.00"}</span>
            <span>Avg Loss: ${metrics.avg_loss_usd?.toFixed(2) || "0.00"}</span>
          </div>
        </div>

        {/* 4. Net Realized Profit/Loss */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Net Realized P&L</span>
            {netProfitAcc >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div
            className={`text-2xl font-bold font-mono ${
              netProfitAcc >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {netProfitAcc >= 0 ? "+" : ""}
            {netProfitAcc.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-xs font-normal text-slate-400">
              {currencyUnit}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>
              USD:{" "}
              <strong
                className={
                  netProfitUSD >= 0 ? "text-emerald-700" : "text-rose-600"
                }
              >
                {netProfitUSD >= 0 ? "+$" : "-$"}
                {Math.abs(netProfitUSD).toFixed(2)}
              </strong>
            </span>
            <span className="text-indigo-600 font-semibold">
              BDT: ৳{Math.abs(netProfitBDT).toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: Active Positions Ready to Exit */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-500" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Active Positions (Ready to Exit)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {activePositions.length} Open
            </span>
          </div>
        </div>

        {positionsLoading && activePositions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
            <span className="text-xs text-slate-400 font-medium">
              Checking open positions in MT5...
            </span>
          </div>
        ) : activePositions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-10 text-center shadow-xs space-y-2">
            <Activity className="w-8 h-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">
              No Active Positions Open
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your terminal currently has no open trades. Open a trade from
              Position Volumes or My Assets to manage executions here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activePositions.map((pos) => {
              const isClosing = closingTickets[pos.ticket];
              const isConfirming = confirmTicket === pos.ticket;
              const isProfit = pos.profit >= 0;

              return (
                <div
                  key={pos.ticket}
                  className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                >
                  {/* Card Header: Symbol, Side, Ticket */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold font-mono text-slate-900">
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
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        Ticket #{pos.ticket} • {pos.time}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 uppercase font-medium">
                        Volume
                      </span>
                      <div className="text-xs font-bold text-slate-800">
                        {pos.volume.toFixed(2)} Lots
                      </div>
                    </div>
                  </div>

                  {/* Prices & Notional Volume */}
                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block">
                        Open Price
                      </span>
                      <strong className="text-slate-800">
                        {pos.price_open.toFixed(5)}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block">
                        Current Price
                      </span>
                      <strong className="text-slate-900">
                        {pos.price_current.toFixed(5)}
                      </strong>
                    </div>
                  </div>

                  {/* Floating P&L */}
                  <div
                    className={`p-3 rounded-lg border ${
                      isProfit
                        ? "bg-emerald-50/60 border-emerald-200 text-emerald-800"
                        : "bg-rose-50/60 border-rose-200 text-rose-800"
                    } flex items-center justify-between font-mono`}
                  >
                    <div>
                      <span className="text-[10px] uppercase font-medium block opacity-75">
                        Floating P&L
                      </span>
                      <span className="text-base font-bold">
                        {pos.profit >= 0 ? "+" : ""}
                        {pos.profit.toFixed(2)} {currencyUnit}
                      </span>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold">
                        {pos.profit_usd >= 0 ? "+$" : "-$"}
                        {Math.abs(pos.profit_usd || 0).toFixed(2)} USD
                      </div>
                      <div className="text-[11px] font-semibold text-indigo-600">
                        ৳{Math.abs((pos.profit_usd || 0) * bdtRate).toFixed(0)} BDT
                      </div>
                    </div>
                  </div>

                  {/* Card Action: Exit Position Button */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                    {isConfirming ? (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          disabled={isClosing}
                          onClick={() => handleClosePosition(pos.ticket)}
                          className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isClosing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>Confirm Exit #{pos.ticket}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmTicket(null)}
                          className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isClosing}
                        onClick={() => setConfirmTicket(pos.ticket)}
                        className="w-full py-2 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-600" />
                        <span>Exit Position (Close Market)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Exited Positions History Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Exited Positions History
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {filteredTrades.length} Records
            </span>
          </div>

          {/* Search, Filter Pills, and Sort */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-48 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search symbol, ticket..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setHistoryFilter("ALL")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  historyFilter === "ALL"
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({closedTrades.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter("WINS")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  historyFilter === "WINS"
                    ? "bg-white text-emerald-700 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-emerald-700"
                }`}
              >
                Wins ({metrics.winning_trades || 0})
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter("LOSSES")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  historyFilter === "LOSSES"
                    ? "bg-white text-rose-700 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-rose-700"
                }`}
              >
                Losses ({metrics.losing_trades || 0})
              </button>
            </div>

            {/* Sort Selector */}
            <select
              value={historySort}
              onChange={(e) => setHistorySort(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="recent">Sort: Most Recent</option>
              <option value="highest_profit">Sort: Highest Profit</option>
              <option value="lowest_profit">Sort: Lowest Profit</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          {historyLoading && closedTrades.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
              <span className="text-xs">Loading trading history from MT5...</span>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <span className="text-xs font-medium">
                No historical closed positions match the search/filter criteria.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Asset</th>
                    <th className="py-3 px-4">Side</th>
                    <th className="py-3 px-4 text-right">Lots</th>
                    <th className="py-3 px-4 text-right">Open Price</th>
                    <th className="py-3 px-4 text-right">Close Price</th>
                    <th className="py-3 px-4">Time & Duration</th>
                    <th className="py-3 px-4 text-right">Realized Profit</th>
                    <th className="py-3 px-4 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredTrades.map((t) => {
                    const isWin = t.is_win;
                    const isLoss = t.is_loss;

                    return (
                      <tr
                        key={t.position_id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        {/* Ticket */}
                        <td className="py-3 px-4 font-bold text-slate-700">
                          #{t.position_id}
                        </td>

                        {/* Asset */}
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {t.symbol}
                        </td>

                        {/* Side */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              t.type === "BUY"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>

                        {/* Lots */}
                        <td className="py-3 px-4 text-right font-bold text-slate-800">
                          {t.volume.toFixed(2)}
                        </td>

                        {/* Open Price */}
                        <td className="py-3 px-4 text-right text-slate-600">
                          {t.open_price.toFixed(5)}
                        </td>

                        {/* Close Price */}
                        <td className="py-3 px-4 text-right text-slate-900 font-bold">
                          {t.close_price.toFixed(5)}
                        </td>

                        {/* Time & Duration */}
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          <div>{t.close_time}</div>
                          <div className="text-[10px] text-slate-400">
                            Duration: {t.duration_str}
                          </div>
                        </td>

                        {/* Realized Profit */}
                        <td className="py-3 px-4 text-right">
                          <div
                            className={`font-bold ${
                              isWin
                                ? "text-emerald-600"
                                : isLoss
                                ? "text-rose-600"
                                : "text-slate-600"
                            }`}
                          >
                            {t.profit >= 0 ? "+" : ""}
                            {t.profit.toFixed(2)} {currencyUnit}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {t.profit_usd >= 0 ? "+$" : "-$"}
                            {Math.abs(t.profit_usd).toFixed(2)} USD • ৳
                            {Math.abs(t.profit_bdt).toFixed(0)} BDT
                          </div>
                        </td>

                        {/* Result Badge */}
                        <td className="py-3 px-4 text-center">
                          {isWin ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              WIN
                            </span>
                          ) : isLoss ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                              LOSS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                              BE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
