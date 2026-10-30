import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Check,
  RefreshCw,
  AlertTriangle,
  Layers,
} from "lucide-react";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";

const ITEMS_PER_PAGE = 10;

export default function AssetList() {
  const { data: response, loading, error } = usePolling(API.assets, 3000);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [optimisticTracked, setOptimisticTracked] = useState({});
  const [isUpdating, setIsUpdating] = useState({});

  const assets = useMemo(() => response?.data || [], [response?.data]);

  // Handle toggling asset tracking in SQLite
  const handleToggle = async (symbol, name) => {
    if (isUpdating[symbol]) return;

    // Optimistically toggle
    const currentStatus =
      optimisticTracked[symbol] !== undefined
        ? optimisticTracked[symbol]
        : assets.find((a) => a.symbol === symbol)?.is_tracked ?? false;

    const nextStatus = !currentStatus;
    setOptimisticTracked((prev) => ({ ...prev, [symbol]: nextStatus }));
    setIsUpdating((prev) => ({ ...prev, [symbol]: true }));

    try {
      const res = await fetch(API.toggleAsset, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, name }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setOptimisticTracked((prev) => ({
          ...prev,
          [symbol]: json.data.is_tracked,
        }));
      }
    } catch {
      // Revert on error
      setOptimisticTracked((prev) => ({ ...prev, [symbol]: currentStatus }));
    } finally {
      setIsUpdating((prev) => ({ ...prev, [symbol]: false }));
    }
  };

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let result = assets.map((a) => ({
      ...a,
      is_tracked:
        optimisticTracked[a.symbol] !== undefined
          ? optimisticTracked[a.symbol]
          : a.is_tracked,
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    if (sortBy === "spread") {
      result.sort((a, b) => a.spread_pips - b.spread_pips);
    } else if (sortBy === "name") {
      result.sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    return result;
  }, [assets, searchQuery, sortBy, optimisticTracked]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE) || 1;
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAssets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAssets, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredAssets.length);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Asset List
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {assets.length} Available
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Browse available MT5 tradeable assets and add them to your custom
            watchlist.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Refresh Prices</span>
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

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search symbol (e.g. EURUSD, US30)..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium cursor-pointer"
          >
            <option value="default">Sort by: Default</option>
            <option value="spread">Lowest Spread</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Asset Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-6">Asset / Symbol</th>
                <th className="py-3 px-6 text-right">Bid</th>
                <th className="py-3 px-6 text-right">Ask</th>
                <th className="py-3 px-6 text-right">Spread</th>
                <th className="py-3 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading && assets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                      <span>Loading tradeable assets from MT5...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedAssets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Layers className="w-6 h-6 text-slate-300" />
                      <span>No assets match your search query.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAssets.map((asset) => {
                  const isAdded = asset.is_tracked;

                  return (
                    <tr
                      key={asset.symbol}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Asset / Symbol */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 font-mono text-sm">
                          {asset.symbol}
                        </div>
                        <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                          {asset.description}
                        </div>
                      </td>

                      {/* Bid */}
                      <td className="py-4 px-6 text-right font-mono text-slate-900 font-semibold">
                        {asset.bid.toFixed(asset.digits)}
                      </td>

                      {/* Ask */}
                      <td className="py-4 px-6 text-right font-mono text-slate-900 font-semibold">
                        {asset.ask.toFixed(asset.digits)}
                      </td>

                      {/* Spread */}
                      <td className="py-4 px-6 text-right font-mono text-emerald-600 font-semibold">
                        {asset.spread_pips} pips
                      </td>

                      {/* Actions: Add Asset Toggle ONLY (Open Position removed) */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggle(asset.symbol, asset.description)
                            }
                            className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                              isAdded
                                ? "bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 text-slate-500" />
                                <span>Add Asset</span>
                              </>
                            )}
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

        {/* Pagination */}
        {filteredAssets.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {startIndex}-{endIndex}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-700">
                {filteredAssets.length}
              </span>{" "}
              assets
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-xs"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors shadow-xs cursor-pointer ${
                    currentPage === page
                      ? "bg-indigo-600 text-white font-semibold"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
