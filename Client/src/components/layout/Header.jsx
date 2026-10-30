import React from "react";
import { Flame } from "lucide-react";
import { NAVIGATION_CONFIG } from "../../config/navigationConfig";
import usePolling from "@/hooks/usePolling";
import { API } from "@/api/endpoint";

export const Header = () => {
  const {
    data: response,
    loading,
    error,
  } = usePolling(API.positions, 2000);

  if (loading && !response)
    return (
      <div className="h-16 border-b border-slate-200 bg-white px-6 flex items-center text-xs text-slate-400">
        Loading live data...
      </div>
    );
  if (error && !response)
    return (
      <div className="h-16 border-b border-slate-200 bg-white px-6 flex items-center text-xs text-rose-500">
        Error: {error}
      </div>
    );

  const payload = response?.data;
  const account = payload?.account || {};
  const summary = payload?.summary || {};

  const isCent = account.is_cent ?? account.currency === "USC";
  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 120.0;

  // Base conversions
  const balanceInUSD = isCent ? (account.balance || 0) / 100 : account.balance || 0;
  const equityInUSD = isCent ? (account.equity || 0) / 100 : account.equity || 0;

  const balanceBDT = balanceInUSD * bdtRate;
  const equityBDT = equityInUSD * bdtRate;

  // Format strings using API data
  const balanceLabel = isCent
    ? `${(account.balance || 0).toLocaleString("en-US", { minimumFractionDigits: account.currency_digits || 2 })} USC`
    : `$${(account.balance || 0).toLocaleString("en-US", { minimumFractionDigits: account.currency_digits || 2 })}`;

  const equityLabel = isCent
    ? `${(account.equity || 0).toLocaleString("en-US", { minimumFractionDigits: account.currency_digits || 2 })} USC`
    : `$${(account.equity || 0).toLocaleString("en-US", { minimumFractionDigits: account.currency_digits || 2 })}`;

  // CFD Total Exposure from summary (matches Position Volume page's card exactly)
  const cfdExposureUSD = summary.total_volume_usd ?? account.trading_volume ?? 0;
  const cfdExposureBDT = cfdExposureUSD * bdtRate;
  const totalLots = summary.total_lots ?? 0;

  const badgeIcon = isCent ? "¢" : "$";
  const badgeColorClass = isCent
    ? "bg-amber-50 border-amber-200 text-amber-700"
    : "bg-indigo-50 border-indigo-200 text-indigo-700";

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Brand Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-base tracking-wider">
          {NAVIGATION_CONFIG.appName.charAt(0)}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight text-slate-900 leading-none">
            {NAVIGATION_CONFIG.appName}
          </span>
          <span className="text-[10px] text-slate-400 font-medium tracking-widest mt-0.5 uppercase">
            {NAVIGATION_CONFIG.appSubtitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        {/* Live USD/BDT Exchange Rate Readout */}
        <div className="hidden lg:flex items-center gap-2 bg-emerald-50/90 border border-emerald-200/90 px-3 py-1.5 rounded-lg shadow-2xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider">
              1 USD
            </span>
            <span className="text-xs font-bold text-emerald-700 leading-tight">
              = ৳{bdtRate.toFixed(2)} BDT
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden lg:block" />

        {/* CFD Total Exposure Readout */}
        <div className="hidden xl:flex items-center gap-4 bg-slate-50 border border-slate-200/80 px-4 py-1.5 rounded-lg shadow-2xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3 h-3 text-indigo-500" />
              CFD Total Exposure
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-bold text-slate-900 text-xs">
                ${cfdExposureUSD.toFixed(2)} USD
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-indigo-600 text-xs">
                ৳{cfdExposureBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200" />

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              Lots
            </span>
            <span className="font-semibold text-slate-700 font-mono text-xs">
              {totalLots.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 hidden xl:block" />

        {/* Account Info from Live API */}
        <div className="flex items-center gap-3">
          <div
            className={`w-7 h-7 rounded border font-semibold text-xs flex items-center justify-center ${badgeColorClass}`}
          >
            {badgeIcon}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-800 text-xs leading-tight">
                {account.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase font-mono bg-slate-100 text-slate-600 border border-slate-200">
                {account.currency}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              #{account.login} • {account.server}
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200" />

        {/* Live Balance & Equity */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              Balance
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-slate-900 text-xs">
                {balanceLabel}
              </span>
              <span className="text-slate-400 text-[11px]">
                / ৳
                {balanceBDT.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Equity
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="font-semibold text-emerald-600 text-xs">
                {equityLabel}
              </span>
              <span className="text-slate-400 text-[11px]">
                / ৳
                {equityBDT.toLocaleString("en-US", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
