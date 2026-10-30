import React, { useState, useMemo } from "react";
import {
  Radio,
  RefreshCw,
  AlertTriangle,
  Clock,
  Globe,
  ExternalLink,
  ShieldCheck,
  Search,
  Zap,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";

export default function News() {
  const { data: response, loading, error } = usePolling(API.news, 10000);

  const [activeTab, setActiveTab] = useState("calendar"); // calendar, market_news
  const [filterImpact, setFilterImpact] = useState("ALL"); // ALL, HIGH, USD, EUR_GBP
  const [searchQuery, setSearchQuery] = useState("");

  const data = response?.data;
  const noTradeCockpit = data?.no_trade_cockpit || {};
  const vulnerablePositions = data?.vulnerable_positions || [];
  const economicEvents = useMemo(() => data?.economic_events || [], [data?.economic_events]);
  const marketNews = useMemo(() => data?.market_news || [], [data?.market_news]);

  const isNoTradeActive = noTradeCockpit.is_active;

  // Filtered economic events
  const filteredEvents = useMemo(() => {
    return economicEvents.filter((ev) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        ev.title?.toLowerCase().includes(q) ||
        ev.country?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterImpact === "HIGH") return ev.impact === "High";
      if (filterImpact === "USD") return ev.country === "USD";
      if (filterImpact === "EUR_GBP")
        return ev.country === "EUR" || ev.country === "GBP" || ev.country === "JPY";

      return true;
    });
  }, [economicEvents, searchQuery, filterImpact]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              News Terminal & Economic Calendar
            </h1>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 font-mono ${
                isNoTradeActive
                  ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              <Radio className="w-3 h-3" />
              {isNoTradeActive ? "NO-TRADE ACTIVE" : "TRADING CLEAR"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            High-impact economic schedule, news descriptions, institutional
            no-trade filters, and real-time event risk on your open MT5 positions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh News</span>
          </button>
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>Error loading news: {error}</span>
        </div>
      )}

      {/* MASTER "WHEN NOT TO TRADE" COCKPIT */}
      <div
        className={`rounded-2xl border p-6 shadow-xs space-y-5 transition-all ${
          isNoTradeActive
            ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20"
            : "bg-emerald-50/50 border-emerald-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs ${
                isNoTradeActive
                  ? "bg-rose-600 animate-pulse"
                  : "bg-emerald-600"
              }`}
            >
              {isNoTradeActive ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {noTradeCockpit.title || "Trading Status Filter"}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isNoTradeActive
                      ? "bg-rose-600 text-white"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {isNoTradeActive ? "DANGER: HIGH SLIPPAGE" : "SAFE EXECUTION"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {noTradeCockpit.recommendation}
              </p>
            </div>
          </div>
        </div>

        {/* 4 Quantitative News Trading Rules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-3 border-t border-slate-200/60 text-xs font-mono">
          {(noTradeCockpit.active_rules || []).map((rule, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg bg-white/80 border border-slate-200/80 text-slate-700 shadow-2xs"
            >
              {rule}
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVE MT5 POSITIONS AT RISK (If any open positions have upcoming tier-1 news) */}
      {vulnerablePositions.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-amber-900 text-sm">
              Active MT5 Positions Exposed to Upcoming News
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 text-amber-900">
              {vulnerablePositions.length} Position(s) Affected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vulnerablePositions.map((pos) => (
              <div
                key={pos.ticket}
                className="bg-white rounded-lg border border-amber-200 p-3.5 space-y-2 text-xs font-mono shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">
                    {pos.symbol} ({pos.type} {pos.volume} Lots)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    #{pos.ticket}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-amber-800 uppercase font-semibold block">
                    Upcoming News in &lt; 12 Hours:
                  </span>
                  {pos.threatening_events?.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[11px] bg-amber-50/60 px-2 py-1 rounded border border-amber-100"
                    >
                      <span className="font-semibold text-slate-800">
                        {ev.country} - {ev.title}
                      </span>
                      <span className="font-bold text-rose-600">
                        {ev.countdown}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: Economic Calendar vs Market News Headlines */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "calendar"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Economic Calendar ({economicEvents.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("market_news")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "market_news"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Real-Time Market Headlines ({marketNews.length})</span>
            </button>
          </div>

          {/* Calendar Search & Filter Pills */}
          {activeTab === "calendar" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-48 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter event or currency..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilterImpact("ALL")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filterImpact === "ALL"
                      ? "bg-white text-slate-900 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterImpact("HIGH")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filterImpact === "HIGH"
                      ? "bg-rose-600 text-white font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-rose-600"
                  }`}
                >
                  High Impact
                </button>
                <button
                  type="button"
                  onClick={() => setFilterImpact("USD")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filterImpact === "USD"
                      ? "bg-white text-indigo-700 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-indigo-700"
                  }`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setFilterImpact("EUR_GBP")}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    filterImpact === "EUR_GBP"
                      ? "bg-white text-slate-900 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  EUR/GBP/JPY
                </button>
              </div>
            </div>
          )}
        </div>

        {/* TAB 1: Economic Calendar Table */}
        {activeTab === "calendar" && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            {loading && economicEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                <span className="text-xs">Fetching economic calendar...</span>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No economic events found matching the filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Time & Countdown</th>
                      <th className="py-3 px-4">Currency</th>
                      <th className="py-3 px-4">Impact</th>
                      <th className="py-3 px-4">Event Description</th>
                      <th className="py-3 px-4 text-right">Forecast</th>
                      <th className="py-3 px-4 text-right">Previous</th>
                      <th className="py-3 px-4">Affected Assets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredEvents.map((ev, i) => {
                      const isHigh = ev.impact === "High";
                      const isMedium = ev.impact === "Medium";
                      const isImminent = ev.status === "IMMINENT";

                      return (
                        <tr
                          key={i}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            isImminent && isHigh ? "bg-rose-50/30" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-bold">
                            <div className="text-slate-900">
                              {ev.date?.replace("T", " ")?.slice(0, 16)}
                            </div>
                            <span
                              className={`text-[10px] ${
                                isImminent && isHigh
                                  ? "text-rose-600 font-bold animate-pulse"
                                  : "text-slate-400 font-normal"
                              }`}
                            >
                              {ev.countdown}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {ev.country}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isHigh
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : isMedium
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {ev.impact}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-semibold text-slate-900 font-sans">
                            {ev.title}
                          </td>

                          <td className="py-3 px-4 text-right text-slate-700">
                            {ev.forecast || "-"}
                          </td>

                          <td className="py-3 px-4 text-right text-slate-500">
                            {ev.previous || "-"}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {(ev.affected_pairs || []).map((p) => (
                                <span
                                  key={p}
                                  className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 font-semibold"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
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

        {/* TAB 2: Market News Headlines */}
        {activeTab === "market_news" && (
          <div className="space-y-3">
            {marketNews.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center text-slate-400 text-xs">
                No market headlines available right now.
              </div>
            ) : (
              marketNews.map((news, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-2 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-bold text-slate-900 text-sm leading-snug">
                      {news.title}
                    </h3>
                    {news.link && (
                      <a
                        href={news.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 p-1 shrink-0"
                        title="Read full article"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {news.description && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {news.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                    <span>Source: {news.source}</span>
                    <span>{news.pub_date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
