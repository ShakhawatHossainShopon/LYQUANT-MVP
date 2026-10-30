import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

const QUICK_LOTS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5];

export default function TradeModal({ isOpen, onClose, asset, onSuccess, isCent: isCentProp }) {
  const [lotInput, setLotInput] = useState("0.01");
  const [specs, setSpecs] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [tradeError, setTradeError] = useState(null);
  const [tradeSuccess, setTradeSuccess] = useState(null);

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 120.0;
  const currentSymbol = asset?.symbol || "";

  // Numeric lot size
  const numericLots = useMemo(() => {
    const val = parseFloat(lotInput);
    return !isNaN(val) && val > 0 ? val : 0.01;
  }, [lotInput]);

  useEffect(() => {
    let ignore = false;
    if (isOpen && currentSymbol) {
      fetch(API.calcTrade, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: currentSymbol, lots: numericLots }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (!ignore && json.success && json.data) {
            setSpecs(json.data);
          }
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, currentSymbol, numericLots]);

  // Specifications
  const isCent = isCentProp ?? specs?.is_cent ?? true;
  const currencyUnit = isCent ? "USC" : "USD";
  const currencyPrefix = isCent ? "¢" : "$";

  // Alert cap draft initialized with asset preset if available
  const defaultAlertCapVal =
    asset?.defaultCap != null
      ? String(asset.defaultCap)
      : isCent
      ? "100"
      : "1.00";
  const [alertCapInput, setAlertCapInput] = useState(defaultAlertCapVal);

  const numericAlertCap = useMemo(() => {
    const val = parseFloat(alertCapInput);
    return !isNaN(val) && val > 0 ? val : isCent ? 100 : 1.0;
  }, [alertCapInput, isCent]);

  const liveBid = specs?.bid ?? asset?.bid ?? 0;
  const liveAsk = specs?.ask ?? asset?.ask ?? 0;
  const digits = specs?.digits ?? asset?.digits ?? 5;
  const spreadPips = specs?.spread_pips ?? asset?.spread_pips ?? 0;

  const volUSD = specs?.volume_usd ?? 0;
  const volBDT = volUSD * bdtRate;
  const volAcc = isCent ? volUSD * 100 : volUSD;

  // Cap % of notional volume calculation
  const capPercentOfBase =
    volAcc > 0 ? (numericAlertCap / volAcc) * 100 : 0;

  const estMarginRaw = specs?.est_margin ?? 0;
  const estMarginUSD =
    specs?.est_margin_usd ?? (isCent ? estMarginRaw / 100 : estMarginRaw);
  const estMarginBDT = estMarginUSD * bdtRate;

  // Execute trade
  const handleExecute = async (type) => {
    setExecuting(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      const res = await fetch(API.openTrade, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: currentSymbol,
          type,
          lots: numericLots,
          sl: 0.0,
          tp: 0.0,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || "Trade execution failed");
      }

      // Automatically store this chosen alert cap for the new ticket in localStorage
      if (json.data?.ticket) {
        try {
          const saved = localStorage.getItem("lyquant_asset_alert_caps_v2");
          const caps = saved ? JSON.parse(saved) : {};
          caps[json.data.ticket] = numericAlertCap;
          localStorage.setItem(
            "lyquant_asset_alert_caps_v2",
            JSON.stringify(caps)
          );
        } catch {
          // Ignore localStorage errors
        }
      }

      setTradeSuccess({
        type,
        ticket: json.data?.ticket,
        price: json.data?.price,
        volume: json.data?.volume,
      });

      if (onSuccess) {
        onSuccess({ ...json.data, cap: numericAlertCap });
      }

      // Auto close after 2 seconds on success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setTradeError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Open Trade Position
            </h3>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {asset.symbol} ({asset.description})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Success Banner */}
          {tradeSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2.5 font-mono animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <strong>Order #{tradeSuccess.ticket} Executed!</strong>
                <div className="text-[11px] text-emerald-700">
                  {tradeSuccess.type} {tradeSuccess.volume} Lots @{" "}
                  {tradeSuccess.price?.toFixed(digits)} • Cap: {numericAlertCap}{" "}
                  {currencyUnit}
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {tradeError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2.5 font-mono">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{tradeError}</span>
            </div>
          )}

          {/* Lot Size Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Lot Size (Volume)
              </label>
              <div className="flex items-center gap-1">
                {QUICK_LOTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setLotInput(String(q))}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${
                      numericLots === q
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={lotInput}
                onChange={(e) => setLotInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(lotInput);
                  if (isNaN(val) || val <= 0) {
                    setLotInput("0.01");
                  }
                }}
                placeholder="0.01"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all text-slate-900"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                Lots
              </span>
            </div>
          </div>

          {/* Key Metrics: Volume in USD, Volume in BDT, Est Margin, Spread */}
          <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-3.5 space-y-2.5 font-mono text-xs">
            {/* Volume in USD & BDT (Prominently featured) */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">
                Notional Volume (USD):
              </span>
              <span className="font-bold text-slate-900 text-sm">
                ${volUSD.toFixed(2)} USD
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 bg-indigo-50/60 p-2 rounded-lg">
              <span className="text-indigo-900 font-semibold text-[11px] uppercase tracking-wide">
                Volume in BDT:
              </span>
              <span className="font-bold text-indigo-700 text-base">
                ৳{volBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Margin and Spread */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block uppercase text-[10px]">
                  Est. Margin
                </span>
                <span className="font-bold text-slate-800">
                  {isCent
                    ? `${estMarginRaw.toFixed(2)} USC`
                    : `$${estMarginUSD.toFixed(2)}`}
                </span>
                <span className="text-slate-400 block text-[10px]">
                  (৳
                  {estMarginBDT.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                  )
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block uppercase text-[10px]">
                  Live Spread
                </span>
                <span className="font-bold text-emerald-600">
                  {spreadPips} pips
                </span>
                <span className="text-slate-400 block text-[10px]">
                  Market Execution
                </span>
              </div>
            </div>
          </div>

          {/* Drawdown Alert Cap Controller & Percentage Calculation */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                Drawdown Alert Cap ({currencyUnit})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Preset for Position
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 font-semibold">
                  {currencyPrefix}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={alertCapInput}
                  onChange={(e) => setAlertCapInput(e.target.value)}
                  onBlur={() => {
                    const val = parseFloat(alertCapInput);
                    if (isNaN(val) || val <= 0) {
                      setAlertCapInput(defaultAlertCapVal);
                    }
                  }}
                  placeholder={isCent ? "100" : "1.00"}
                  className="w-full pl-6 pr-10 py-1.5 text-xs font-bold font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900"
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
                  {capPercentOfBase.toFixed(2)}% of Vol
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons: Sell and Buy */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* SELL BUTTON */}
            <button
              type="button"
              disabled={executing || tradeSuccess !== null}
              onClick={() => handleExecute("SELL")}
              className="flex flex-col items-center justify-center py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-98"
            >
              <span className="text-[10px] font-bold tracking-wider uppercase text-rose-500">
                Sell / Short
              </span>
              <span className="font-bold text-sm font-mono mt-0.5 group-hover:scale-105 transition-transform text-rose-700">
                {liveBid > 0 ? liveBid.toFixed(digits) : "..."}
              </span>
            </button>

            {/* BUY BUTTON */}
            <button
              type="button"
              disabled={executing || tradeSuccess !== null}
              onClick={() => handleExecute("BUY")}
              className="flex flex-col items-center justify-center py-3 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 text-emerald-700 transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed shadow-xs active:scale-98"
            >
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-500">
                Buy / Long
              </span>
              <span className="font-bold text-sm font-mono mt-0.5 group-hover:scale-105 transition-transform text-emerald-700">
                {liveAsk > 0 ? liveAsk.toFixed(digits) : "..."}
              </span>
            </button>
          </div>

          {executing && (
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-slate-400 pt-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              <span>Sending order to MetaTrader 5...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
