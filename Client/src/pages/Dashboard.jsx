import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Percent,
  Scale,
  LogOut,
  Plus,
  RefreshCw,
  Wallet,
  Zap,
  CheckCircle2,
  PieChart,
  Layers,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";
import TradeModal from "@/components/trade/TradeModal";

export default function Dashboard() {
  // Live polling for positions & account
  const {
    data: positionsRes,
    loading: positionsLoading,
    error: positionsError,
  } = usePolling(API.positions, 2000);

  // Live polling for historical metrics
  const { data: historyRes, error: historyError } = usePolling(
    API.history,
    5000,
  );

  // Live polling for tracked watchlist
  const { data: watchlistRes } = usePolling(API.trackedAssets, 3000);

  const [selectedAssetForTrade, setSelectedAssetForTrade] = useState(null);

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 120.0;

  const posData = positionsRes?.data;
  const account = posData?.account || {};
  const summary = posData?.summary || {};
  const activePositions = posData?.positions || [];

  const histData = historyRes?.data;
  const metrics = histData?.metrics || {};
  const recentTrades = (histData?.trades || []).slice(0, 5);

  const watchlist = watchlistRes?.data || [];

  const isCent = account.is_cent ?? account.currency === "USC";
  const currencyUnit = isCent ? "USC" : "USD";

  // Account figures
  const equityUSD = isCent ? (account.equity || 0) / 100 : account.equity || 0;
  const equityBDT = equityUSD * bdtRate;
  const balanceUSD = isCent
    ? (account.balance || 0) / 100
    : account.balance || 0;
  const balanceBDT = balanceUSD * bdtRate;
  const marginFreeUSD = isCent
    ? (account.margin_free || 0) / 100
    : account.margin_free || 0;
  const marginFreeBDT = marginFreeUSD * bdtRate;
  const marginLevel = account.margin_level || 0;
  const floatingProfit = account.profit || 0;

  // Exposure figures
  const totalVolUSD = summary.total_volume_usd || 0;
  const totalVolBDT = totalVolUSD * bdtRate;
  const totalLots = summary.total_lots || 0;

  // Historical performance
  const winRate = metrics.win_rate ?? 0;
  const profitFactor = metrics.profit_factor ?? 0;
  const rrRatio = metrics.risk_reward_ratio ?? 0;

  // Directional calculation for active positions
  const longVolUSD = activePositions
    .filter((p) => p.type === "BUY")
    .reduce((acc, p) => acc + (p.volume_usd || 0), 0);
  const shortVolUSD = activePositions
    .filter((p) => p.type === "SELL")
    .reduce((acc, p) => acc + (p.volume_usd || 0), 0);
  const longPct =
    totalVolUSD > 0 ? Math.round((longVolUSD / totalVolUSD) * 100) : 50;
  const shortPct = totalVolUSD > 0 ? 100 - longPct : 50;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Executive Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Executive Trading & Business Analytics
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Connected
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
              {account.server || "MT5 Real"} • {currencyUnit}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Holistic quantitative command center: live equity monitoring, risk
            leverage, exposure breakdown, and trading performance.
          </p>
        </div>

        {/* Action Hub Shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/portfolio"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Portfolio Intelligence</span>
          </Link>
          <Link
            to="/positions"
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>Drawdown Alerts</span>
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs transition-colors shadow-xs cursor-pointer"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Global Connection / Data Errors */}
      {(positionsError || historyError) && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs font-mono">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
          <span>
            Error connecting to MT5 backend: {positionsError || historyError}
          </span>
        </div>
      )}

      {/* 4 Core Quantitative Business KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Portfolio Value */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Portfolio Equity</span>
            <Wallet className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              ${equityUSD.toFixed(2)}{" "}
              <span className="text-xs font-normal text-slate-400">USD</span>
            </div>
            <div className="text-xs text-indigo-600 font-semibold font-mono mt-0.5">
              ৳{equityBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })}{" "}
              BDT
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>
              Bal: ${balanceUSD.toFixed(2)} (৳{balanceBDT.toFixed(0)})
            </span>
            <span
              className={`font-semibold ${
                floatingProfit >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              Floating: {floatingProfit >= 0 ? "+" : ""}
              {floatingProfit.toFixed(2)} {currencyUnit}
            </span>
          </div>
        </div>

        {/* 2. Total CFD Exposure */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Total CFD Exposure</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              ${totalVolUSD.toFixed(2)}{" "}
              <span className="text-xs font-normal text-slate-400">USD</span>
            </div>
            <div className="text-xs text-indigo-600 font-semibold font-mono mt-0.5">
              ৳
              {totalVolBDT.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}{" "}
              BDT
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>Lots: {totalLots.toFixed(2)}</span>
            <span>{activePositions.length} Active Positions</span>
          </div>
        </div>

        {/* 3. Trading Edge (Win Rate & PF) */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Trading Edge</span>
            <Percent className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {winRate.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (PF: {profitFactor.toFixed(2)})
            </span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>R:R: 1:{rrRatio.toFixed(2)}</span>
            <span className="text-indigo-600 font-semibold">
              {metrics.total_trades || 0} Trades Analyzed
            </span>
          </div>
        </div>

        {/* 4. Margin Health & Capital Buffer */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Margin Safety</span>
            <Scale className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div
              className={`text-2xl font-bold font-mono ${
                marginLevel > 200
                  ? "text-emerald-600"
                  : marginLevel > 100
                    ? "text-amber-600"
                    : "text-rose-600"
              }`}
            >
              {marginLevel.toFixed(0)}%
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              Free: ${marginFreeUSD.toFixed(2)} USD (৳{marginFreeBDT.toFixed(0)}
              )
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>Buffer Status</span>
            <span className="text-emerald-600 font-semibold">
              {marginLevel > 200 ? "Healthy Capital" : "Monitor Risk"}
            </span>
          </div>
        </div>
      </div>

      {/* Analytics Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Positions Ticker & Glimpse */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                Active Market Positions
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Real-time open exposures monitored on Exness MetaTrader 5
              </p>
            </div>
            <Link
              to="/positions"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>View Full Volumes & Caps</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {positionsLoading && activePositions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading open positions...
            </div>
          ) : activePositions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-xs font-medium text-slate-600">
                No Active Open Positions
              </div>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                No market risk currently open. Use the Watchlist or Asset List
                to open a position.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activePositions.map((pos) => {
                const isProfit = (pos.profit || 0) >= 0;
                return (
                  <div
                    key={pos.ticket}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/50 rounded-lg px-2 transition-colors font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pos.type === "BUY"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {pos.type}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {pos.symbol}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          #{pos.ticket} • {pos.volume.toFixed(2)} Lots
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block text-right text-xs">
                      <div className="text-slate-800 font-semibold">
                        ${(pos.volume_usd || 0).toFixed(2)} USD
                      </div>
                      <div className="text-[10px] text-indigo-600">
                        ৳
                        {((pos.volume_usd || 0) * bdtRate).toLocaleString(
                          "en-US",
                          { maximumFractionDigits: 0 },
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-sm font-bold ${
                          isProfit ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {pos.profit >= 0 ? "+" : ""}
                        {(pos.profit || 0).toFixed(2)} {currencyUnit}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {pos.profit_usd >= 0 ? "+$" : "-$"}
                        {Math.abs(pos.profit_usd || 0).toFixed(2)} USD
                      </div>
                    </div>

                    <Link
                      to="/exit-positions"
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                      title="Exit this position"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Directional Bias & Business Risk Gauge */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-5 flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              Directional Risk Balance
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Long vs Short notional weight distribution
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                LONG: ${longVolUSD.toFixed(2)} ({longPct}%)
              </span>
              <span className="text-rose-700 font-bold flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                SHORT: ${shortVolUSD.toFixed(2)} ({shortPct}%)
              </span>
            </div>

            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${longPct}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${shortPct}%` }}
              />
            </div>
          </div>

          {/* Quick Business Analytics Box */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Gross Realized Win:</span>
              <span className="font-bold text-emerald-600">
                +${metrics.gross_profit_usd?.toFixed(2) || "0.00"} USD
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Gross Realized Loss:</span>
              <span className="font-bold text-rose-600">
                -${metrics.gross_loss_usd?.toFixed(2) || "0.00"} USD
              </span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-slate-800 font-bold">
              <span>Net Business P&L:</span>
              <span
                className={
                  (metrics.net_profit_usd || 0) >= 0
                    ? "text-emerald-700"
                    : "text-rose-600"
                }
              >
                {(metrics.net_profit_usd || 0) >= 0 ? "+$" : "-$"}
                {Math.abs(metrics.net_profit_usd || 0).toFixed(2)} USD (৳
                {Math.abs(metrics.net_profit_bdt || 0).toFixed(0)})
              </span>
            </div>
          </div>

          {/* Direct Navigation Action */}
        </div>
      </div>

      {/* Bottom Grid: Recent Closed Executions & Watchlist Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Executions Stream */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Recent Closed Executions
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Latest completed market operations
              </p>
            </div>
            <Link
              to="/exit-positions"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Full History ({metrics.total_trades || 0})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentTrades.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No closed executions yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 font-mono text-xs">
              {recentTrades.map((t) => {
                const isWin = t.is_win;
                return (
                  <div
                    key={t.position_id}
                    className="py-2.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          t.type === "BUY"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {t.type}
                      </span>
                      <div>
                        <div className="font-bold text-slate-800">
                          {t.symbol}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t.close_time} • {t.duration_str}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-bold ${
                          isWin ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {t.profit >= 0 ? "+" : ""}
                        {t.profit.toFixed(2)} {currencyUnit}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.profit_usd >= 0 ? "+$" : "-$"}
                        {Math.abs(t.profit_usd).toFixed(2)} USD • ৳
                        {Math.abs(t.profit_bdt).toFixed(0)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Watchlist Quick Launch Pad */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Tracked Asset Quick-Trade Pad
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Instant market access to your saved asset watchlist
              </p>
            </div>
            <Link
              to="/my-assets"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              <span>Watchlist</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {watchlist.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs space-y-2">
              <div>No assets in watchlist yet.</div>
              <Link
                to="/assets"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Assets to Watchlist</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 font-mono text-xs">
              {watchlist.slice(0, 4).map((a) => (
                <div
                  key={a.symbol}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900">{a.symbol}</div>
                    <div className="text-[10px] text-slate-400">
                      Spread: {a.spread_pips} pips
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-slate-400 text-[10px] block">
                      Ask
                    </span>
                    <strong className="text-slate-800">
                      {(a.ask || 0).toFixed(a.digits || 5)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAssetForTrade(a)}
                    className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Trade</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trade Modal Trigger if clicked */}
      {selectedAssetForTrade && (
        <TradeModal
          key={selectedAssetForTrade.symbol}
          isOpen={true}
          asset={selectedAssetForTrade}
          isCent={isCent}
          onClose={() => setSelectedAssetForTrade(null)}
        />
      )}
    </div>
  );
}
