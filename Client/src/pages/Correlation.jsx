import React, { useState } from "react";

const CURRENCIES = [
  { code: "AUD", name: "Australian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "USD", name: "US Dollar" },
];

const ASSETS = [
  "AUD/JPY",
  "AUD/NZD",
  "CAD/JPY",
  "EUR/AUD",
  "EUR/JPY",
  "EUR/NZD",
  "GBP/AUD",
  "GBP/JPY",
  "GBP/NZD",
  "GBP/USD",
  "USD/JPY",
];

const CORRELATION_DATA = {
  "AUD/JPY": {
    "AUD/JPY": 100.0,
    "AUD/NZD": 62.3,
    "CAD/JPY": 40.2,
    "EUR/AUD": -79.2,
    "EUR/JPY": 33.4,
    "EUR/NZD": -41.7,
    "GBP/AUD": -64.9,
    "GBP/JPY": 38.4,
    "GBP/NZD": -13.8,
    "GBP/USD": -71.8,
    "USD/JPY": 82.6,
  },
  "AUD/NZD": {
    "AUD/JPY": 62.3,
    "AUD/NZD": 100.0,
    "CAD/JPY": -34.0,
    "EUR/AUD": -87.7,
    "EUR/JPY": -38.5,
    "EUR/NZD": 13.2,
    "GBP/AUD": -83.5,
    "GBP/JPY": -29.4,
    "GBP/NZD": 8.2,
    "GBP/USD": -71.3,
    "USD/JPY": 38.5,
  },
  "CAD/JPY": {
    "AUD/JPY": 40.2,
    "AUD/NZD": -34.0,
    "CAD/JPY": 100.0,
    "EUR/AUD": 15.3,
    "EUR/JPY": 86.2,
    "EUR/NZD": null,
    "GBP/AUD": null,
    "GBP/JPY": 78.9,
    "GBP/NZD": null,
    "GBP/USD": -22.4,
    "USD/JPY": 69.1,
  },
  "EUR/AUD": {
    "AUD/JPY": -79.2,
    "AUD/NZD": -87.7,
    "CAD/JPY": 15.3,
    "EUR/AUD": 100.0,
    "EUR/JPY": 30.8,
    "EUR/NZD": 35.5,
    "GBP/AUD": 93.3,
    "GBP/JPY": 20.5,
    "GBP/NZD": 28.4,
    "GBP/USD": 75.8,
    "USD/JPY": -47.8,
  },
  "EUR/JPY": {
    "AUD/JPY": 33.4,
    "AUD/NZD": -38.5,
    "CAD/JPY": 86.2,
    "EUR/AUD": 30.8,
    "EUR/JPY": 100.0,
    "EUR/NZD": -10.2,
    "GBP/AUD": 42.9,
    "GBP/JPY": 91.6,
    "GBP/NZD": 22.1,
    "GBP/USD": 5.4,
    "USD/JPY": 54.7,
  },
  "EUR/NZD": {
    "AUD/JPY": -41.7,
    "AUD/NZD": 13.2,
    "CAD/JPY": null,
    "EUR/AUD": 35.5,
    "EUR/JPY": -10.2,
    "EUR/NZD": 100.0,
    "GBP/AUD": null,
    "GBP/JPY": -14.2,
    "GBP/NZD": null,
    "GBP/USD": 16.6,
    "USD/JPY": -22.6,
  },
  "GBP/AUD": {
    "AUD/JPY": -64.9,
    "AUD/NZD": -83.5,
    "CAD/JPY": null,
    "EUR/AUD": 93.3,
    "EUR/JPY": 42.9,
    "EUR/NZD": null,
    "GBP/AUD": 100.0,
    "GBP/JPY": 45.0,
    "GBP/NZD": null,
    "GBP/USD": 75.7,
    "USD/JPY": -32.1,
  },
  "GBP/JPY": {
    "AUD/JPY": 38.4,
    "AUD/NZD": -29.4,
    "CAD/JPY": 78.9,
    "EUR/AUD": 20.5,
    "EUR/JPY": 91.6,
    "EUR/NZD": -14.2,
    "GBP/AUD": 45.0,
    "GBP/JPY": 100.0,
    "GBP/NZD": 39.3,
    "GBP/USD": 6.4,
    "USD/JPY": 59.1,
  },
  "GBP/NZD": {
    "AUD/JPY": -13.8,
    "AUD/NZD": 8.2,
    "CAD/JPY": null,
    "EUR/AUD": 28.4,
    "EUR/JPY": 22.1,
    "EUR/NZD": null,
    "GBP/AUD": null,
    "GBP/JPY": 39.3,
    "GBP/NZD": 100.0,
    "GBP/USD": 18.8,
    "USD/JPY": 10.1,
  },
  "GBP/USD": {
    "AUD/JPY": -71.8,
    "AUD/NZD": -71.3,
    "CAD/JPY": -22.4,
    "EUR/AUD": 75.8,
    "EUR/JPY": 5.4,
    "EUR/NZD": 16.6,
    "GBP/AUD": 75.7,
    "GBP/JPY": 6.4,
    "GBP/NZD": 18.8,
    "GBP/USD": 100.0,
    "USD/JPY": -76.6,
  },
  "USD/JPY": {
    "AUD/JPY": 82.6,
    "AUD/NZD": 38.5,
    "CAD/JPY": 69.1,
    "EUR/AUD": -47.8,
    "EUR/JPY": 54.7,
    "EUR/NZD": -22.6,
    "GBP/AUD": -32.1,
    "GBP/JPY": 59.1,
    "GBP/NZD": 10.1,
    "GBP/USD": -76.6,
    "USD/JPY": 100.0,
  },
};

function getCorrelation(a, b) {
  if (
    CORRELATION_DATA[a] &&
    Object.prototype.hasOwnProperty.call(CORRELATION_DATA[a], b)
  ) {
    return CORRELATION_DATA[a][b];
  }
  if (
    CORRELATION_DATA[b] &&
    Object.prototype.hasOwnProperty.call(CORRELATION_DATA[b], a)
  ) {
    return CORRELATION_DATA[b][a];
  }
  return null;
}

function getCorrelationStyle(value) {
  if (value === null || value === undefined) return "text-slate-400";
  if (value >= 70)
    return "text-emerald-700 bg-emerald-50/70 font-bold";
  if (value >= 30) return "text-emerald-600 font-semibold";
  if (value <= -70)
    return "text-rose-700 bg-rose-50/70 font-bold";
  if (value <= -30) return "text-rose-500 font-semibold";
  return "text-slate-500 font-medium";
}

function formatCorrelation(value) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

export default function Correlation() {
  const [selectedAssets, setSelectedAssets] = useState([
    "AUD/JPY",
    "GBP/USD",
    "USD/JPY",
  ]);

  const toggleAsset = (asset) => {
    setSelectedAssets((prev) =>
      prev.includes(asset) ? prev.filter((a) => a !== asset) : [...prev, asset]
    );
  };

  const selectAll = () => setSelectedAssets([...ASSETS]);
  const clearAll = () => setSelectedAssets([]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Forex Correlation Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyze co-movement, overlap, and hedging relationships across asset
            pairs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            Live Feed Active
          </span>
        </div>
      </div>

      {/* Currency Assets Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {CURRENCIES.map((currency) => (
          <div
            key={currency.code}
            className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs"
          >
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">
              Currency
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {currency.code}
            </div>
            <div className="text-xs text-slate-500 mt-1">{currency.name}</div>
          </div>
        ))}
      </div>

      {/* Correlation Lookup Section */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Asset Correlation Lookup
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select one or more assets to inspect their correlation coefficient
              rows.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md font-mono">
            {selectedAssets.length} selected
          </span>
        </div>

        {/* Selector Box */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Select Assets
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ASSETS.map((asset) => {
              const active = selectedAssets.includes(asset);
              return (
                <button
                  key={asset}
                  type="button"
                  onClick={() => toggleAsset(asset)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-mono cursor-pointer transition-all ${
                    active
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  {asset}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lookup Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 text-left sticky left-0 z-10 bg-slate-50 uppercase text-[11px] tracking-wider text-slate-500">
                  SELECTED
                </th>
                {ASSETS.map((asset) => (
                  <th
                    key={asset}
                    className="p-3 text-center font-mono whitespace-nowrap text-slate-700"
                  >
                    {asset}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-mono text-slate-700">
              {selectedAssets.length === 0 ? (
                <tr>
                  <td
                    colSpan={ASSETS.length + 1}
                    className="p-8 text-center text-slate-400 font-sans"
                  >
                    Select an asset above to view correlations
                  </td>
                </tr>
              ) : (
                selectedAssets.map((rowAsset) => (
                  <tr
                    key={rowAsset}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="p-3 text-indigo-600 font-bold sticky left-0 bg-white shadow-xs z-5 whitespace-nowrap">
                      {rowAsset}
                    </td>
                    {ASSETS.map((colAsset) => {
                      const value = getCorrelation(rowAsset, colAsset);
                      return (
                        <td
                          key={colAsset}
                          className={`p-3 text-center whitespace-nowrap transition-colors hover:bg-slate-100/60 ${getCorrelationStyle(
                            value
                          )}`}
                        >
                          {formatCorrelation(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-wrap gap-6 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold font-mono">
            +70%
          </span>
          <span>Strong positive</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 font-semibold font-mono">+30%</span>
          <span>Positive</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-mono">0%</span>
          <span>Weak</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-rose-500 font-semibold font-mono">-30%</span>
          <span>Negative</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold font-mono">
            -70%
          </span>
          <span>Strong negative</span>
        </div>
      </div>
    </div>
  );
}
