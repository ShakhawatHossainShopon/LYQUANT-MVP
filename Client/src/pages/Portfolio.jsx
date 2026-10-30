import React, { useState, useMemo } from "react";
import {
  PieChart,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Layers,
  Activity,
  Wallet,
  Sparkles,
  Calculator,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

export default function Portfolio() {
  const { data: response, error } = usePolling(API.portfolio, 3000);

  const [activeTab, setActiveTab] = useState("holdings"); // holdings, asset_matrix, growth_calculator
  const [projectionMonths, setProjectionMonths] = useState(6);
  const [targetMonthlyPct, setTargetMonthlyPct] = useState(10);

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 120.0;
  const data = response?.data;

  const account = data?.account || {};
  const exposure = data?.exposure || {};
  const drawdown = data?.drawdown || {};
  const holdings = useMemo(() => data?.holdings || [], [data?.holdings]);
  const categories = useMemo(() => data?.category_allocation || [], [data?.category_allocation]);
  const growthCurve = useMemo(() => data?.growth_curve || [], [data?.growth_curve]);
  const symbolPerformance = useMemo(
    () => data?.symbol_performance || [],
    [data?.symbol_performance]
  );

  const isCent = account.is_cent ?? account.currency === "USC";
  const currencyUnit = isCent ? "USC" : "USD";

  // Account figures
  const equityUSD = account.equity_usd || 0;
  const equityBDT = account.equity_bdt || 0;
  const balanceUSD = account.balance_usd || 0;
  const balanceBDT = account.balance_bdt || 0;
  const marginFreeUSD = account.margin_free_usd || 0;
  const marginFreeBDT = account.margin_free_bdt || 0;
  const marginUsedPct = account.margin_used_pct || 0;
  const freeCapitalPct = account.free_capital_pct || 0;
  const floatingProfit = account.floating_profit || 0;

  // Exposure figures
  const totalVolUSD = exposure.total_volume_usd || 0;
  const totalVolBDT = exposure.total_volume_bdt || 0;
  const longVolUSD = exposure.long_volume_usd || 0;
  const shortVolUSD = exposure.short_volume_usd || 0;
  const longPct = exposure.long_pct || 0;
  const shortPct = exposure.short_pct || 0;

  // Drawdown & Peaks
  const maxDrawdownUSD = drawdown.max_drawdown_usd || 0;
  const maxDrawdownBDT = drawdown.max_drawdown_bdt || 0;
  const drawdownPct = drawdown.drawdown_pct || 0;

  // Growth compounding projection calculation
  const projectedValues = useMemo(() => {
    const r = targetMonthlyPct / 100;
    const months = projectionMonths;
    const startEquity = equityUSD > 0 ? equityUSD : 100;
    const endEquity = startEquity * Math.pow(1 + r, months);
    const profitGenerated = endEquity - startEquity;
    return {
      startEquity,
      endEquity,
      profitGenerated,
      endEquityBDT: endEquity * bdtRate,
      profitGeneratedBDT: profitGenerated * bdtRate,
    };
  }, [equityUSD, targetMonthlyPct, projectionMonths, bdtRate]);

  // Mini SVG chart points from growthCurve
  const chartPoints = useMemo(() => {
    if (!growthCurve || growthCurve.length < 2) return null;
    const sample = growthCurve.slice(-30); // Last 30 trades
    const profits = sample.map((p) => p.cum_profit);
    const minP = Math.min(...profits);
    const maxP = Math.max(...profits);
    const range = maxP - minP || 1;

    const width = 600;
    const height = 140;
    const padX = 20;
    const padY = 20;

    const points = sample.map((pt, i) => {
      const x = padX + (i / (sample.length - 1)) * (width - 2 * padX);
      const y =
        height - padY - ((pt.cum_profit - minP) / range) * (height - 2 * padY);
      return { x, y, ...pt };
    });

    const svgPath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const areaPath = `${svgPath} L ${points[points.length - 1].x.toFixed(
      1
    )} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

    return { points, svgPath, areaPath, width, height, minP, maxP };
  }, [growthCurve]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Quantitative Portfolio & Capital Growth
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 font-mono">
              <PieChart className="w-3 h-3 text-indigo-600" />
              Live Portfolio
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
              {currencyUnit} Account
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time capital tracking, asset allocation weights, margin exposure
            buffer, and equity compounding curves.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs font-mono">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Connection warning: {error}</span>
        </div>
      )}

      {/* Top 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Portfolio Equity */}
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
              ৳{equityBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })} BDT
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>
              Bal: ${balanceUSD.toFixed(2)} (৳{balanceBDT.toFixed(0)})
            </span>
            <span
              className={`font-semibold flex items-center gap-0.5 ${
                floatingProfit >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {floatingProfit >= 0 ? "+" : ""}
              {floatingProfit.toFixed(2)} {currencyUnit}
            </span>
          </div>
        </div>

        {/* 2. Free Capital & Margin Buffer */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Free Capital Buffer</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              ${marginFreeUSD.toFixed(2)}{" "}
              <span className="text-xs font-normal text-slate-400">USD</span>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              ৳{marginFreeBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })} BDT
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>Used: {marginUsedPct}%</span>
            <span className="text-emerald-600 font-semibold">
              Buffer: {freeCapitalPct}% Free
            </span>
          </div>
        </div>

        {/* 3. CFD Total Exposure & Directional Ratio */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>CFD Exposure</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              ${totalVolUSD.toFixed(2)}{" "}
              <span className="text-xs font-normal text-slate-400">USD</span>
            </div>
            <div className="text-xs text-indigo-600 font-semibold font-mono mt-0.5">
              ৳{totalVolBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })} BDT
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>{exposure.active_count || 0} Positions</span>
            <span>
              <strong className="text-emerald-600">{longPct}% L</strong> /{" "}
              <strong className="text-rose-600">{shortPct}% S</strong>
            </span>
          </div>
        </div>

        {/* 4. Peak Capital & Historical Drawdown */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium uppercase tracking-wider">
            <span>Peak Drawdown Risk</span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-rose-600">
              -{drawdownPct.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              -${maxDrawdownUSD.toFixed(2)} USD (৳{maxDrawdownBDT.toFixed(0)})
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px] font-mono text-slate-500">
            <span>Margin Level</span>
            <span className="text-emerald-600 font-semibold">
              {(account.margin_level || 0).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Growth Curve & Directional Allocation Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Cumulative Growth Trajectory Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                  Historical Cumulative Growth Curve
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Trajectory of closed trade profits ({growthCurve.length} completed executions)
              </p>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-slate-400 text-[11px]">Latest Trajectory:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded ${
                  (growthCurve[growthCurve.length - 1]?.cum_profit || 0) >= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {growthCurve[growthCurve.length - 1]?.cum_profit || 0} {currencyUnit}
              </span>
            </div>
          </div>

          {/* SVG Growth Chart */}
          {chartPoints ? (
            <div className="relative pt-2">
              <svg
                viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
                className="w-full h-36 overflow-visible"
              >
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Zero line if crosses zero */}
                <line
                  x1="0"
                  y1={chartPoints.height - 20}
                  x2={chartPoints.width}
                  y2={chartPoints.height - 20}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Fill Area */}
                <path d={chartPoints.areaPath} fill="url(#growthGrad)" />

                {/* Main Curve Line */}
                <path
                  d={chartPoints.svgPath}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Final Point Indicator */}
                {chartPoints.points.length > 0 && (
                  <circle
                    cx={chartPoints.points[chartPoints.points.length - 1].x}
                    cy={chartPoints.points[chartPoints.points.length - 1].y}
                    r="4"
                    fill="#4f46e5"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                )}
              </svg>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
                <span>Start: {growthCurve[0]?.time || "0"}</span>
                <span>Peak: {drawdown.peak_profit_acc || 0} {currencyUnit}</span>
                <span>Current: {growthCurve[growthCurve.length - 1]?.time || "Now"}</span>
              </div>
            </div>
          ) : (
            <div className="h-36 flex items-center justify-center text-xs text-slate-400 font-mono">
              Collecting growth curve points...
            </div>
          )}
        </div>

        {/* Right Col: Directional Exposure & Asset Class Distribution */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              Directional & Asset Allocation
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Portfolio exposure balance across directions and markets
            </p>
          </div>

          {/* Long vs Short Dual Bar */}
          <div className="space-y-2">
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

            {/* Split Bar */}
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
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

          {/* Category Breakdown */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
              Market Distribution
            </span>
            {categories.length === 0 ? (
              <div className="text-xs text-slate-400 font-mono py-2">
                No active categories loaded.
              </div>
            ) : (
              categories.map((c) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-slate-700">
                      {c.category}
                    </span>
                    <span className="text-slate-900 font-bold">
                      ${c.volume_usd.toFixed(2)} ({c.pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation: Active Holdings vs Asset Matrix vs Growth Simulator */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("holdings")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "holdings"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              Active Holdings ({holdings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("asset_matrix")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "asset_matrix"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              Historical Asset Profitability Matrix
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("growth_calculator")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "growth_calculator"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-indigo-600"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Capital Compounding Simulator</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Active Holdings Table */}
        {activeTab === "holdings" && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            {holdings.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <span className="text-xs font-medium">
                  No active holdings currently in portfolio.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-4">Market</th>
                      <th className="py-3 px-4">Side</th>
                      <th className="py-3 px-4 text-right">Lots</th>
                      <th className="py-3 px-4 text-right">Notional Volume</th>
                      <th className="py-3 px-4 text-right">Volume (BDT)</th>
                      <th className="py-3 px-4 text-right">Weight %</th>
                      <th className="py-3 px-4 text-right">Floating P&L</th>
                      <th className="py-3 px-4 text-right">Return %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {holdings.map((h) => {
                      const isProfit = h.profit >= 0;
                      return (
                        <tr
                          key={h.ticket}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {h.symbol}
                            <div className="text-[10px] text-slate-400 font-normal">
                              #{h.ticket}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {h.category}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                h.type === "BUY"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {h.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">
                            {h.volume.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            ${h.volume_usd.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-indigo-600 font-semibold">
                            ৳{h.volume_bdt.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="font-bold text-slate-700">
                                {h.weight_pct}%
                              </span>
                              <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full rounded-full"
                                  style={{ width: `${Math.min(100, h.weight_pct)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-bold ${
                                isProfit ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {h.profit >= 0 ? "+" : ""}
                              {h.profit.toFixed(2)} {currencyUnit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-bold ${
                                h.return_pct >= 0
                                  ? "text-emerald-600"
                                  : "text-rose-600"
                              }`}
                            >
                              {h.return_pct >= 0 ? "+" : ""}
                              {h.return_pct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Asset Profitability Matrix */}
        {activeTab === "asset_matrix" && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Symbol</th>
                    <th className="py-3 px-4">Market</th>
                    <th className="py-3 px-4 text-right">Total Executions</th>
                    <th className="py-3 px-4 text-right">Win Rate %</th>
                    <th className="py-3 px-4 text-right">Lots Traded</th>
                    <th className="py-3 px-4 text-right">Net Profit ({currencyUnit})</th>
                    <th className="py-3 px-4 text-right">Net Profit (USD)</th>
                    <th className="py-3 px-4 text-right">Net Profit (BDT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {symbolPerformance.map((s) => {
                    const isProfit = s.profit >= 0;
                    return (
                      <tr
                        key={s.symbol}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {s.symbol}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {s.category}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-700">
                          {s.trades}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-bold ${
                              s.win_rate >= 50
                                ? "text-emerald-600"
                                : s.win_rate >= 40
                                ? "text-slate-800"
                                : "text-rose-600"
                            }`}
                          >
                            {s.win_rate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700">
                          {s.lots.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          <span
                            className={
                              isProfit ? "text-emerald-600" : "text-rose-600"
                            }
                          >
                            {s.profit >= 0 ? "+" : ""}
                            {s.profit.toFixed(2)} {currencyUnit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-semibold ${
                              s.profit_usd >= 0
                                ? "text-emerald-700"
                                : "text-rose-600"
                            }`}
                          >
                            {s.profit_usd >= 0 ? "+$" : "-$"}
                            {Math.abs(s.profit_usd).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-indigo-600">
                          ৳{Math.abs(s.profit_bdt).toFixed(0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Capital Compounding Simulator */}
        {activeTab === "growth_calculator" && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                Capital Compounding & Revenue Projections
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate potential equity growth based on monthly return targets and reinvestment.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              {/* Controls */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Target Return (%)
                  </label>
                  <div className="flex items-center gap-2">
                    {[5, 10, 15, 20].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setTargetMonthlyPct(pct)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          targetMonthlyPct === pct
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {pct}% / mo
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Projection Horizon
                  </label>
                  <div className="flex items-center gap-2">
                    {[3, 6, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setProjectionMonths(m)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          projectionMonths === m
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {m} Months
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulation Result Box */}
              <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3 shadow-2xs font-mono">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Starting Equity:</span>
                  <span className="font-bold text-slate-800">
                    ${projectedValues.startEquity.toFixed(2)} USD
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Projected Equity ({projectionMonths}mo):</span>
                  <span className="text-lg font-bold text-indigo-700">
                    ${projectedValues.endEquity.toFixed(2)} USD
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-700 font-semibold">Net Projected Profit:</span>
                  <span className="font-bold text-emerald-600">
                    +${projectedValues.profitGenerated.toFixed(2)} USD (৳
                    {projectedValues.profitGeneratedBDT.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })} BDT)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
