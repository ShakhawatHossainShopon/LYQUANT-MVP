import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  ExternalLink,
  Search,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Layers,
  Edit2,
  X,
  Link as LinkIcon,
  MinusCircle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Plus,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import TradeModal from "@/components/trade/TradeModal";

const TREND_OPTIONS = [
  {
    id: "UPTREND",
    label: "Uptrend / Long",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pillClass: "hover:bg-emerald-50 text-emerald-700",
    icon: ArrowUpRight,
  },
  {
    id: "DOWNTREND",
    label: "Downtrend / Short",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    pillClass: "hover:bg-rose-50 text-rose-700",
    icon: ArrowDownRight,
  },
  {
    id: "NEUTRAL",
    label: "Neutral / Nothing",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    pillClass: "hover:bg-slate-100 text-slate-600",
    icon: MinusCircle,
  },
];

export default function Charts() {
  const { data: response, loading, error } = usePolling(API.trackedAssets, 3000);

  const [searchQuery, setSearchQuery] = useState("");
  const [trendFilter, setTrendFilter] = useState("ALL"); // ALL, UPTREND, DOWNTREND, NEUTRAL
  const [linkFilter, setLinkFilter] = useState("ALL"); // ALL, HAS_LINK, MISSING_LINK

  // Local optimistic state for trend status & chart link
  const [localTrends, setLocalTrends] = useState({});
  const [localLinks, setLocalLinks] = useState({});

  // Quick edit modal
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingUrl, setEditingUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Trade Modal state
  const [tradeAsset, setTradeAsset] = useState(null);

  const rawAssets = response?.data || [];

  const trackedAssets = useMemo(() => {
    return rawAssets.map((a) => ({
      ...a,
      chart_link:
        localLinks[a.symbol] !== undefined
          ? localLinks[a.symbol]
          : a.chart_link || "",
      trend_status:
        localTrends[a.symbol] !== undefined
          ? localTrends[a.symbol]
          : a.trend_status || "NEUTRAL",
    }));
  }, [rawAssets, localLinks, localTrends]);

  // Status counts for filter pills
  const counts = useMemo(() => {
    const uptrend = trackedAssets.filter((a) => a.trend_status === "UPTREND").length;
    const downtrend = trackedAssets.filter((a) => a.trend_status === "DOWNTREND").length;
    const neutral = trackedAssets.filter(
      (a) => !a.trend_status || a.trend_status === "NEUTRAL"
    ).length;
    return { uptrend, downtrend, neutral, all: trackedAssets.length };
  }, [trackedAssets]);

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return trackedAssets.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        a.symbol?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q);

      if (!matchSearch) return false;

      // Trend filter
      if (trendFilter === "UPTREND" && a.trend_status !== "UPTREND") return false;
      if (trendFilter === "DOWNTREND" && a.trend_status !== "DOWNTREND") return false;
      if (trendFilter === "NEUTRAL" && a.trend_status !== "NEUTRAL" && a.trend_status) return false;

      // Link filter
      const hasLink = Boolean(a.chart_link && a.chart_link.trim() !== "");
      if (linkFilter === "HAS_LINK" && !hasLink) return false;
      if (linkFilter === "MISSING_LINK" && hasLink) return false;

      return true;
    });
  }, [trackedAssets, searchQuery, trendFilter, linkFilter]);

  // Handle changing trend status
  const handleUpdateTrend = async (symbol, newStatus) => {
    setLocalTrends((prev) => ({ ...prev, [symbol]: newStatus }));

    try {
      await fetch(API.updateTrendStatus, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, trend_status: newStatus }),
      });
    } catch {
      // Revert if error
      setLocalTrends((prev) => {
        const next = { ...prev };
        delete next[symbol];
        return next;
      });
    }
  };

  // Save updated chart link
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!editingAsset) return;

    const symbol = editingAsset.symbol;
    const url = editingUrl.trim();

    setIsSaving(true);
    setLocalLinks((prev) => ({ ...prev, [symbol]: url }));

    try {
      await fetch(API.updateChartLink, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, chart_link: url }),
      });
    } catch {
      // Ignore transient errors
    } finally {
      setIsSaving(false);
      setEditingAsset(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <LineChart className="w-5 h-5 text-indigo-600" />
              <span>Asset Charts Hub</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {trackedAssets.length} Tracked
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Classify and tag your assets as Uptrend/Long, Downtrend/Short, or Neutral, and visit live charts instantly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/assets"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Asset List</span>
          </Link>
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

      {/* Connection Warning */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>
            <strong>Connection Warning:</strong> Unable to connect to MT5 server (
            {error}). Make sure MetaTrader 5 is running.
          </span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Search */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbol or name..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
          />
        </div>

        {/* Trend Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600 overflow-x-auto w-full lg:w-auto">
          <button
            type="button"
            onClick={() => setTrendFilter("ALL")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap ${
              trendFilter === "ALL"
                ? "bg-white text-slate-900 font-semibold shadow-xs"
                : "hover:text-slate-900"
            }`}
          >
            All Trends ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setTrendFilter("UPTREND")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              trendFilter === "UPTREND"
                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Uptrend ({counts.uptrend})</span>
          </button>

          <button
            type="button"
            onClick={() => setTrendFilter("DOWNTREND")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              trendFilter === "DOWNTREND"
                ? "bg-rose-600 text-white font-semibold shadow-xs"
                : "text-rose-700 hover:bg-rose-50"
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Downtrend ({counts.downtrend})</span>
          </button>

          <button
            type="button"
            onClick={() => setTrendFilter("NEUTRAL")}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              trendFilter === "NEUTRAL"
                ? "bg-white text-slate-800 font-semibold shadow-xs"
                : "hover:text-slate-900"
            }`}
          >
            <MinusCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Neutral ({counts.neutral})</span>
          </button>
        </div>

        {/* Link Filter Select */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <select
            value={linkFilter}
            onChange={(e) => setLinkFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium cursor-pointer"
          >
            <option value="ALL">All Link Statuses</option>
            <option value="HAS_LINK">With Chart Link</option>
            <option value="MISSING_LINK">No Chart Link</option>
          </select>
        </div>
      </div>

      {/* Chart Grid */}
      {loading && trackedAssets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">Loading charts directory...</span>
          </div>
        </div>
      ) : trackedAssets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <LineChart className="w-8 h-8 text-slate-300" />
            <span className="text-base font-semibold text-slate-700">
              No Tracked Assets Found
            </span>
            <p className="text-xs text-slate-400 max-w-sm">
              Add assets from the Asset List and attach their chart links to access them here.
            </p>
            <Link
              to="/assets"
              className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs"
            >
              Browse Asset List
            </Link>
          </div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center text-slate-400 text-xs shadow-xs">
          No assets match the active trend and search filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => {
            const hasChart = Boolean(asset.chart_link && asset.chart_link.trim() !== "");
            const currentTrend = asset.trend_status || "NEUTRAL";

            return (
              <div
                key={asset.symbol}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                {/* Header: Symbol, Description, Edit Link & Current Status Badge */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 font-mono text-base tracking-tight">
                        {asset.symbol}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAsset(asset);
                          setEditingUrl(asset.chart_link || "");
                        }}
                        title="Edit Chart Link"
                        className="w-5 h-5 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {asset.description}
                    </p>
                  </div>

                  {/* Trend Status Indicator Badge */}
                  <div>
                    {currentTrend === "UPTREND" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                        <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                        Uptrend
                      </span>
                    )}
                    {currentTrend === "DOWNTREND" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 shadow-2xs">
                        <ArrowDownRight className="w-3 h-3 text-rose-600" />
                        Downtrend
                      </span>
                    )}
                    {currentTrend === "NEUTRAL" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                        <MinusCircle className="w-3 h-3 text-slate-400" />
                        Neutral
                      </span>
                    )}
                  </div>
                </div>

                {/* Trend Status Selector Buttons */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Chart Trend Status
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => handleUpdateTrend(asset.symbol, "UPTREND")}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        currentTrend === "UPTREND"
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "text-emerald-700 hover:bg-emerald-100/70"
                      }`}
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      <span>Uptrend</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateTrend(asset.symbol, "DOWNTREND")}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        currentTrend === "DOWNTREND"
                          ? "bg-rose-600 text-white shadow-2xs"
                          : "text-rose-700 hover:bg-rose-100/70"
                      }`}
                    >
                      <ArrowDownRight className="w-3 h-3" />
                      <span>Downtrend</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateTrend(asset.symbol, "NEUTRAL")}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        currentTrend === "NEUTRAL"
                          ? "bg-white text-slate-900 font-bold shadow-2xs border border-slate-200"
                          : "text-slate-500 hover:bg-slate-200/60"
                      }`}
                    >
                      <MinusCircle className="w-3 h-3 text-slate-400" />
                      <span>Neutral</span>
                    </button>
                  </div>
                </div>

                {/* Live Quotes Mini Bar */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-medium">
                      Bid
                    </span>
                    <span className="font-bold text-slate-900">
                      {asset.bid.toFixed(asset.digits)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block font-medium">
                      Ask
                    </span>
                    <span className="font-bold text-slate-900">
                      {asset.ask.toFixed(asset.digits)}
                    </span>
                  </div>
                </div>

                {/* Chart Link Preview or Action Button */}
                <div className="pt-1">
                  {hasChart ? (
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono text-slate-400 truncate bg-slate-50 p-2 rounded border border-slate-100 flex items-center gap-1.5">
                        <LinkIcon className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate">{asset.chart_link}</span>
                      </div>
                      <a
                        href={asset.chart_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Chart</span>
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400 text-center py-1">
                        No chart link configured yet
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAsset(asset);
                          setEditingUrl("");
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>Attach Chart Link</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Chart URL Modal */}
      {editingAsset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-modal-backdrop">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-modal-content">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-slate-900 text-xs">
                  Chart Link: {editingAsset.symbol}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Chart URL (e.g. TradingView link)
                </label>
                <input
                  type="url"
                  value={editingUrl}
                  onChange={(e) => setEditingUrl(e.target.value)}
                  placeholder="https://www.tradingview.com/chart/..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono text-slate-900 transition-all"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  {isSaving ? "Saving..." : "Save Chart Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Open Position Trade Modal */}
      {tradeAsset && (
        <TradeModal
          key={tradeAsset.symbol}
          isOpen={true}
          asset={tradeAsset}
          onClose={() => setTradeAsset(null)}
        />
      )}
    </div>
  );
}
