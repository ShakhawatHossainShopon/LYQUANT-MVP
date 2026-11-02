import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Trash2,
  RefreshCw,
  AlertTriangle,
  Bookmark,
  Plus,
  TrendingUp,
  ExternalLink,
  Edit2,
  X,
  Check,
  Link as LinkIcon,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";
import TradeModal from "@/components/trade/TradeModal";

export default function MyAssets() {
  const { data: response, loading, error } = usePolling(
    API.trackedAssets,
    2000
  );

  const [removedSymbols, setRemovedSymbols] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState({});
  const [selectedAssetForTrade, setSelectedAssetForTrade] = useState(null);

  // Edit chart link state
  const [editingAsset, setEditingAsset] = useState(null);
  const [editingChartUrl, setEditingChartUrl] = useState("");
  const [localChartLinks, setLocalChartLinks] = useState({});
  const [isSavingChart, setIsSavingChart] = useState(false);

  const trackedAssets = useMemo(() => {
    const raw = response?.data || [];
    return raw
      .filter((a) => !removedSymbols.has(a.symbol))
      .map((a) => ({
        ...a,
        chart_link:
          localChartLinks[a.symbol] !== undefined
            ? localChartLinks[a.symbol]
            : a.chart_link || "",
      }));
  }, [response?.data, removedSymbols, localChartLinks]);

  // Remove asset from SQLite
  const handleRemove = async (symbol) => {
    if (isDeleting[symbol]) return;

    // Optimistic removal
    setRemovedSymbols((prev) => new Set([...prev, symbol]));
    setIsDeleting((prev) => ({ ...prev, [symbol]: true }));

    try {
      const res = await fetch(API.toggleAsset, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();
      if (!json.success) {
        // Revert on error
        setRemovedSymbols((prev) => {
          const next = new Set(prev);
          next.delete(symbol);
          return next;
        });
      }
    } catch {
      // Revert on error
      setRemovedSymbols((prev) => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
    } finally {
      setIsDeleting((prev) => ({ ...prev, [symbol]: false }));
    }
  };

  // Open edit modal for chart link
  const handleOpenEdit = (asset) => {
    setEditingAsset(asset);
    setEditingChartUrl(asset.chart_link || "");
  };

  // Save updated chart link
  const handleSaveChartLink = async (e) => {
    e?.preventDefault();
    if (!editingAsset) return;

    const symbol = editingAsset.symbol;
    const url = editingChartUrl.trim();

    setIsSavingChart(true);
    setLocalChartLinks((prev) => ({ ...prev, [symbol]: url }));

    try {
      await fetch(API.updateChartLink, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, chart_link: url }),
      });
    } catch {
      // Ignore transient errors
    } finally {
      setIsSavingChart(false);
      setEditingAsset(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              My Tracked Assets
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {trackedAssets.length} Saved
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quick real-time overview of your saved custom asset watchlist with direct chart links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/assets"
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add More Assets</span>
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

      {/* Backend / MT5 Error banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>
            <strong>Connection Warning:</strong> Unable to connect to MT5 server (
            {error}). Make sure MetaTrader 5 is running.
          </span>
        </div>
      )}

      {/* Cards Grid Layout */}
      {loading && trackedAssets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-sm font-medium">
              Loading your saved assets from database...
            </span>
          </div>
        </div>
      ) : trackedAssets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-16 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <Bookmark className="w-8 h-8 text-slate-300" />
            <span className="text-base font-semibold text-slate-700">
              No Tracked Assets Yet
            </span>
            <p className="text-xs text-slate-400 max-w-sm">
              You haven't added any assets to your watchlist. Browse the Asset
              List to track your favorite currency pairs and indices.
            </p>
            <Link
              to="/assets"
              className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Browse Asset List</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trackedAssets.map((asset) => {
            const hasChart = Boolean(asset.chart_link && asset.chart_link.trim() !== "");

            return (
              <div
                key={asset.symbol}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all group"
              >
                {/* Header: Symbol, Description, Edit Link & Remove */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 font-mono text-base tracking-tight">
                        {asset.symbol}
                      </h3>
                      {/* Negligible, small edit chart button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(asset)}
                        title={hasChart ? "Edit Chart Link" : "Attach Chart Link"}
                        className="w-5 h-5 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {asset.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(asset.symbol)}
                    title="Remove from My Assets"
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Prices: Bid and Ask */}
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">
                      Bid Price
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                      {asset.bid.toFixed(asset.digits)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-medium">
                      Ask Price
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                      {asset.ask.toFixed(asset.digits)}
                    </span>
                  </div>
                </div>

                {/* Spread & Actions: Open Chart Button and Open Position */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <span className="text-xs text-emerald-600 font-mono font-semibold">
                    Spread: {asset.spread_pips} pips
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Open Chart Button */}
                    {hasChart ? (
                      <a
                        href={asset.chart_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                        title={asset.chart_link}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Chart</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(asset)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 font-medium text-xs transition-colors border border-dashed border-slate-200 cursor-pointer flex items-center gap-1"
                        title="Add chart link to open"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Chart Link</span>
                      </button>
                    )}

                    {/* Open Position Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedAssetForTrade(asset)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-98 shrink-0"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Open Position</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Small Edit Chart Link Modal */}
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

            <form onSubmit={handleSaveChartLink} className="p-5 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Chart URL
                </label>
                <input
                  type="url"
                  value={editingChartUrl}
                  onChange={(e) => setEditingChartUrl(e.target.value)}
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
                  disabled={isSavingChart}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  {isSavingChart ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Position Trade Modal */}
      {selectedAssetForTrade && (
        <TradeModal
          key={selectedAssetForTrade.symbol}
          isOpen={true}
          asset={selectedAssetForTrade}
          onClose={() => setSelectedAssetForTrade(null)}
        />
      )}
    </div>
  );
}
