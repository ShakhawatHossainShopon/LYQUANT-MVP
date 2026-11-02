import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  DollarSign,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  Sparkles,
  Target,
} from "lucide-react";
import { API } from "@/api/endpoint";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";

const QUICK_LOTS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
const QUICK_RR = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0];

export default function TradeModal({
  isOpen,
  onClose,
  asset,
  onSuccess,
  isCent: isCentProp,
}) {
  const navigate = useNavigate();

  const [lotInput, setLotInput] = useState("0.01");
  const [tradeType, setTradeType] = useState("BUY"); // "BUY" or "SELL"
  const [slPriceInput, setSlPriceInput] = useState("");
  const [tpPriceInput, setTpPriceInput] = useState("");
  const [rrRatioInput, setRrRatioInput] = useState("1.5");

  const [specs, setSpecs] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [tradeError, setTradeError] = useState(null);
  const [tradeSuccess, setTradeSuccess] = useState(null);

  const bdtRate = NAVIGATION_CONFIG.usdToBdtRate || 120.0;
  const currentSymbol = asset?.symbol || "";

  // Broker volume constraints
  const volumeMin = specs?.volume_min ?? 0.01;
  const volumeMax = specs?.volume_max ?? 100.0;
  const volumeStep = specs?.volume_step ?? 0.01;

  // Numeric lot size
  const numericLots = useMemo(() => {
    const val = parseFloat(lotInput);
    return !isNaN(val) && val > 0 ? val : 0.01;
  }, [lotInput]);

  // Numeric RR ratio
  const numericRR = useMemo(() => {
    const val = parseFloat(rrRatioInput);
    return !isNaN(val) && val > 0 ? val : 1.5;
  }, [rrRatioInput]);

  // Fetch specs from backend whenever symbol or lots change
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

  // Fetch live risk management overview (tier limit & open trades risk)
  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      fetch(API.risk.overview)
        .then((res) => res.json())
        .then((json) => {
          if (!ignore && json.success && json.data) {
            setRiskData(json.data);
          }
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [isOpen]);

  // Account currency configuration
  const isCent = isCentProp ?? specs?.is_cent ?? true;
  const currencyUnit = isCent ? "USC" : "USD";
  const currencyPrefix = isCent ? "¢" : "$";

  const liveBid = specs?.bid ?? asset?.bid ?? 0;
  const liveAsk = specs?.ask ?? asset?.ask ?? 0;
  const digits = specs?.digits ?? asset?.digits ?? 2;
  const contractSize = specs?.contract_size ?? 1.0;
  const spreadPips = specs?.spread_pips ?? asset?.spread_pips ?? 0;

  const entryPrice = tradeType === "BUY" ? liveAsk : liveBid;

  const volUSD = specs?.volume_usd ?? 0;
  const volBDT = volUSD * bdtRate;
  const volAcc = isCent ? volUSD * 100 : volUSD;

  const estMarginRaw = specs?.est_margin ?? 0;
  const estMarginUSD =
    specs?.est_margin_usd ?? (isCent ? estMarginRaw / 100 : estMarginRaw);
  const estMarginBDT = estMarginUSD * bdtRate;

  // Risk Management Framework Integration
  const tierRisk = riskData?.tier_risk ?? 20.0;
  const activeOpenRisk = riskData?.active_open_risk ?? 0.0;
  const tierStepName = riskData?.tier?.stepName ?? "Current Tier";
  const tierMode = riskData?.tier?.mode ?? "Framework";
  const openTradesCount = riskData?.open_trades_count ?? 0;

  // Tier risk is ALWAYS fulfilled per trade setup ($20.00)
  const currentTargetRiskAcc = tierRisk;

  // Initialize default SL & TP price calibrated to Target Tier Risk
  useEffect(() => {
    if (entryPrice > 0 && slPriceInput === "") {
      const targetLossAcc = tierRisk;
      const targetLossUSD = isCent ? targetLossAcc / 100.0 : targetLossAcc;
      const priceDistance = targetLossUSD / (numericLots * contractSize);

      const initialSL =
        tradeType === "BUY"
          ? Math.max(0, entryPrice - priceDistance)
          : entryPrice + priceDistance;
      setSlPriceInput(initialSL.toFixed(digits));

      // Calculate matching initial TP based on RR ratio
      const tpDistance = priceDistance * numericRR;
      const initialTP =
        tradeType === "BUY"
          ? entryPrice + tpDistance
          : Math.max(0, entryPrice - tpDistance);
      setTpPriceInput(initialTP.toFixed(digits));
    }
  }, [entryPrice, tradeType, digits, slPriceInput, tierRisk, numericLots, contractSize, isCent, numericRR]);

  // Recalculate TP whenever SL Price or RR ratio changes
  const applyRRToTP = (newRRVal, currentSlVal) => {
    const slVal = currentSlVal !== undefined ? parseFloat(currentSlVal) : parseFloat(slPriceInput);
    const rr = newRRVal !== undefined ? parseFloat(newRRVal) : numericRR;

    if (!isNaN(slVal) && slVal > 0 && entryPrice > 0 && !isNaN(rr) && rr > 0) {
      const slDistance = Math.abs(entryPrice - slVal);
      const tpDistance = slDistance * rr;
      const computedTP =
        tradeType === "BUY"
          ? entryPrice + tpDistance
          : Math.max(0, entryPrice - tpDistance);
      setTpPriceInput(computedTP.toFixed(digits));
    }
  };

  // When user clicks a quick RR pill or types a custom RR ratio
  const handleSelectRR = (rrVal) => {
    setRrRatioInput(String(rrVal));
    applyRRToTP(rrVal, slPriceInput);
  };

  // When user manually edits SL Price, recalculate TP to maintain current RR ratio
  const handleSlPriceChange = (val) => {
    setSlPriceInput(val);
    setTradeError(null);
    applyRRToTP(numericRR, val);
  };

  // Numeric SL and TP values
  const numericSlPrice = useMemo(() => {
    const val = parseFloat(slPriceInput);
    return !isNaN(val) && val > 0 ? val : 0;
  }, [slPriceInput]);

  const numericTpPrice = useMemo(() => {
    const val = parseFloat(tpPriceInput);
    return !isNaN(val) && val > 0 ? val : 0;
  }, [tpPriceInput]);

  // Validation logic for SL and TP relative to entry price & trade direction
  const validationError = useMemo(() => {
    if (!numericSlPrice || numericSlPrice <= 0) {
      return "Please enter a valid Stop Loss price.";
    }
    if (entryPrice <= 0) return null;

    if (tradeType === "BUY") {
      if (numericSlPrice >= entryPrice) {
        return `Incorrect SL: For a BUY trade, Stop Loss must be strictly lower than Ask price (${entryPrice.toFixed(
          digits
        )}).`;
      }
      if (numericTpPrice > 0 && numericTpPrice <= entryPrice) {
        return `Incorrect TP: For a BUY trade, Take Profit must be strictly higher than Ask price (${entryPrice.toFixed(
          digits
        )}).`;
      }
    } else {
      if (numericSlPrice <= entryPrice) {
        return `Incorrect SL: For a SELL trade, Stop Loss must be strictly higher than Bid price (${entryPrice.toFixed(
          digits
        )}).`;
      }
      if (numericTpPrice > 0 && numericTpPrice >= entryPrice) {
        return `Incorrect TP: For a SELL trade, Take Profit must be strictly lower than Bid price (${entryPrice.toFixed(
          digits
        )}).`;
      }
    }
    return null;
  }, [numericSlPrice, numericTpPrice, entryPrice, tradeType, digits]);

  // Dynamic Position Sizing Risk Calculation:
  // Expected loss & Expected reward
  const {
    expectedLossAcc,
    expectedLossUSD,
    expectedLossBDT,
    expectedRewardAcc,
    expectedRewardUSD,
    expectedRewardBDT,
    riskPercentOfBase,
  } = useMemo(() => {
    if (numericSlPrice <= 0 || entryPrice <= 0) {
      return {
        expectedLossAcc: 0,
        expectedLossUSD: 0,
        expectedLossBDT: 0,
        expectedRewardAcc: 0,
        expectedRewardUSD: 0,
        expectedRewardBDT: 0,
        riskPercentOfBase: 0,
      };
    }

    const slDistance = Math.abs(entryPrice - numericSlPrice);
    const lossUSD = slDistance * numericLots * contractSize;
    const lossAcc = isCent ? lossUSD * 100.0 : lossUSD;
    const lossBDT = lossUSD * bdtRate;
    const riskPct = volAcc > 0 ? (lossAcc / volAcc) * 100 : 0;

    const rewardUSD = lossUSD * numericRR;
    const rewardAcc = isCent ? rewardUSD * 100.0 : rewardUSD;
    const rewardBDT = rewardUSD * bdtRate;

    return {
      expectedLossAcc: lossAcc,
      expectedLossUSD: lossUSD,
      expectedLossBDT: lossBDT,
      expectedRewardAcc: rewardAcc,
      expectedRewardUSD: rewardUSD,
      expectedRewardBDT: rewardBDT,
      riskPercentOfBase: riskPct,
    };
  }, [
    numericSlPrice,
    entryPrice,
    numericLots,
    contractSize,
    isCent,
    bdtRate,
    volAcc,
    numericRR,
  ]);

  // Auto-calculated Suggested Lot Size from SL Price & Target Risk
  // Uses broker constraints (volume_min, volume_max, volume_step)
  const suggestedLotsFromSL = useMemo(() => {
    if (numericSlPrice <= 0 || entryPrice <= 0 || contractSize <= 0) return null;
    const priceDistance = Math.abs(entryPrice - numericSlPrice);
    if (priceDistance <= 0) return null;

    const targetRiskUSD = isCent ? currentTargetRiskAcc / 100.0 : currentTargetRiskAcc;
    if (targetRiskUSD <= 0) return null;

    const rawLots = targetRiskUSD / (priceDistance * contractSize);
    // Align with volume_step
    const step = volumeStep > 0 ? volumeStep : 0.01;
    const stepsCount = Math.round(rawLots / step);
    let calculatedLots = stepsCount * step;

    // Decimal precision for rounding
    const stepDecimals = step.toString().split(".")[1]?.length || 2;
    calculatedLots = parseFloat(calculatedLots.toFixed(stepDecimals));

    // Clamp between volume_min and volume_max
    calculatedLots = Math.max(volumeMin, Math.min(volumeMax, calculatedLots));
    return parseFloat(calculatedLots.toFixed(stepDecimals));
  }, [
    numericSlPrice,
    entryPrice,
    contractSize,
    isCent,
    currentTargetRiskAcc,
    volumeStep,
    volumeMin,
    volumeMax,
  ]);

  // Quick action: Apply Suggested Lot Size directly to lotInput
  const handleApplySuggestedLot = () => {
    if (suggestedLotsFromSL && suggestedLotsFromSL > 0) {
      setLotInput(String(suggestedLotsFromSL));
      setTradeError(null);
    }
  };

  // Quick action: Calibrate SL Price based on numericLots to fulfill Tier Risk ($20.00)
  const handleApplyTierRisk = () => {
    if (tierRisk > 0 && entryPrice > 0 && numericLots > 0 && contractSize > 0) {
      const targetLossUSD = isCent ? tierRisk / 100.0 : tierRisk;
      const priceDistance = targetLossUSD / (numericLots * contractSize);
      const newSL =
        tradeType === "BUY"
          ? Math.max(0, entryPrice - priceDistance)
          : entryPrice + priceDistance;
      const newSLStr = newSL.toFixed(digits);
      setSlPriceInput(newSLStr);
      applyRRToTP(numericRR, newSLStr);
    }
  };

  // Handle trade direction toggle
  const handleTypeSelect = (type) => {
    setTradeType(type);
    setTradeError(null);
    const newEntry = type === "BUY" ? liveAsk : liveBid;
    if (newEntry > 0 && numericSlPrice > 0) {
      const currentDistance = Math.abs(entryPrice - numericSlPrice);
      const safeDistance =
        currentDistance > 0
          ? currentDistance
          : digits >= 4
          ? 0.005
          : digits >= 2
          ? newEntry > 1000
            ? 50.0
            : 0.5
          : 5.0;

      const newSL =
        type === "BUY"
          ? Math.max(0, newEntry - safeDistance)
          : newEntry + safeDistance;
      const newSLStr = newSL.toFixed(digits);
      setSlPriceInput(newSLStr);

      const tpDist = safeDistance * numericRR;
      const newTP =
        type === "BUY"
          ? newEntry + tpDist
          : Math.max(0, newEntry - tpDist);
      setTpPriceInput(newTP.toFixed(digits));
    }
  };

  // Execute trade
  const handleExecute = async () => {
    if (validationError) {
      setTradeError(validationError);
      return;
    }

    setExecuting(true);
    setTradeError(null);
    setTradeSuccess(null);

    try {
      const res = await fetch(API.openTrade, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: currentSymbol,
          type: tradeType,
          lots: numericLots,
          sl: numericSlPrice,
          tp: numericTpPrice,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || json.message || "Trade execution failed");
      }

      // Automatically store this position's SL cap (expected loss) for the new ticket
      if (json.data?.ticket) {
        try {
          const saved = localStorage.getItem("lyquant_asset_alert_caps_v2");
          const caps = saved ? JSON.parse(saved) : {};
          caps[json.data.ticket] = Number(expectedLossAcc.toFixed(2));
          localStorage.setItem(
            "lyquant_asset_alert_caps_v2",
            JSON.stringify(caps)
          );
        } catch {
          // Ignore localStorage errors
        }
      }

      setTradeSuccess({
        type: tradeType,
        ticket: json.data?.ticket,
        price: json.data?.price,
        volume: json.data?.volume,
        sl: numericSlPrice,
        tp: numericTpPrice,
        cap: expectedLossAcc,
      });

      if (onSuccess) {
        onSuccess({
          ...json.data,
          sl: numericSlPrice,
          tp: numericTpPrice,
          cap: expectedLossAcc,
        });
      }

      // Close modal immediately and push to position volume page
      onClose();
      navigate("/positions");
    } catch (err) {
      setTradeError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen || !asset) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 animate-modal-backdrop transition-all">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-900/10 w-full max-w-lg overflow-hidden animate-modal-content transition-all ring-1 ring-slate-900/5">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/90 bg-linear-to-r from-slate-50/60 to-white">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base tracking-tight">
                Position Sizing & Risk Setup
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50/80 text-indigo-700 border border-indigo-200/80 uppercase shadow-2xs">
                {currencyUnit}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
              <span className="font-semibold text-slate-800">{asset.symbol}</span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-sans">{asset.description}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Validation or Execution Error Banner */}
          {(tradeError || validationError) && (
            <div className="p-3.5 bg-rose-50/90 border border-rose-200/90 rounded-xl text-rose-800 text-xs flex items-center gap-3 font-mono shadow-2xs transition-all">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-medium">{tradeError || validationError}</span>
            </div>
          )}

          {/* Direction Selector (BUY vs SELL) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
              Order Direction
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Buy Button */}
              <button
                type="button"
                onClick={() => handleTypeSelect("BUY")}
                className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                  tradeType === "BUY"
                    ? "bg-linear-to-b from-emerald-500 to-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20"
                    : "bg-slate-50/80 hover:bg-slate-100 text-slate-700 border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <span className={`text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 ${tradeType === "BUY" ? "text-emerald-100" : "text-emerald-600"}`}>
                  <TrendingUp className="w-3 h-3" />
                  Buy / Long (Ask)
                </span>
                <span className="font-mono font-bold text-base mt-0.5 tracking-tight">
                  {liveAsk > 0 ? liveAsk.toFixed(digits) : "..."}
                </span>
              </button>

              {/* Sell Button */}
              <button
                type="button"
                onClick={() => handleTypeSelect("SELL")}
                className={`py-3 px-4 rounded-xl border flex flex-col items-center justify-center transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                  tradeType === "SELL"
                    ? "bg-linear-to-b from-rose-500 to-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20"
                    : "bg-slate-50/80 hover:bg-slate-100 text-slate-700 border-slate-200/80 hover:border-slate-300"
                }`}
              >
                <span className={`text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 ${tradeType === "SELL" ? "text-rose-100" : "text-rose-600"}`}>
                  <TrendingDown className="w-3 h-3" />
                  Sell / Short (Bid)
                </span>
                <span className="font-mono font-bold text-base mt-0.5 tracking-tight">
                  {liveBid > 0 ? liveBid.toFixed(digits) : "..."}
                </span>
              </button>
            </div>
          </div>

          {/* 1. Lot Size Input with Quick Pills & Auto-Size Button */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
                Lot Size (Volume)
              </label>
              {/* Quick lot pills */}
              <div className="flex items-center gap-1">
                {QUICK_LOTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setLotInput(String(q));
                      setTradeError(null);
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                      numericLots === q
                        ? "bg-indigo-600 text-white shadow-2xs"
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
                onChange={(e) => {
                  setLotInput(e.target.value);
                  setTradeError(null);
                }}
                onBlur={() => {
                  const val = parseFloat(lotInput);
                  if (isNaN(val) || val <= 0) {
                    setLotInput("0.01");
                  }
                }}
                placeholder="0.01"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/90 hover:bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-all text-slate-900 shadow-2xs"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold uppercase">
                Lots
              </span>
            </div>
          </div>

          {/* 2. Risk to Reward (R:R) Ratio Selector */}
          <div className="space-y-1.5 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-600" />
                <span>Risk to Reward Ratio (1:X)</span>
              </label>

              {/* Quick R:R Ratio Pills */}
              <div className="flex items-center gap-1">
                {QUICK_RR.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleSelectRR(r)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all duration-150 cursor-pointer active:scale-95 ${
                      numericRR === r
                        ? "bg-emerald-600 text-white shadow-2xs"
                        : "bg-white hover:bg-slate-200/80 text-slate-700 border border-slate-200"
                    }`}
                  >
                    1:{r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={rrRatioInput}
                  onChange={(e) => {
                    setRrRatioInput(e.target.value);
                    applyRRToTP(e.target.value, slPriceInput);
                  }}
                  placeholder="1.5"
                  className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 shadow-2xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-slate-400">
                  Ratio (1:{numericRR})
                </span>
              </div>

              <div className="text-right font-mono text-[11px] px-2">
                <span className="text-slate-400 block text-[10px]">Reward Multiplier</span>
                <span className="font-bold text-emerald-600">
                  +{expectedRewardAcc.toFixed(2)} {currencyUnit}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Stop Loss & Take Profit Target Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Stop Loss Price */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
                Stop Loss (SL Price)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={slPriceInput}
                  onChange={(e) => handleSlPriceChange(e.target.value)}
                  placeholder={`e.g. ${entryPrice.toFixed(digits)}`}
                  className={`w-full px-3.5 py-2.5 text-sm font-bold font-mono bg-slate-50/90 hover:bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all text-slate-900 shadow-2xs ${
                    validationError && validationError.includes("SL")
                      ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600 text-rose-900"
                      : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-600"
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold uppercase">
                  SL Price
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">
                {tradeType === "BUY" ? "Must be below" : "Must be above"} Entry (
                {entryPrice.toFixed(digits)})
              </span>
            </div>

            {/* Take Profit Price */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase">
                Take Profit (TP Price)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={tpPriceInput}
                  onChange={(e) => {
                    setTpPriceInput(e.target.value);
                    setTradeError(null);
                  }}
                  placeholder="Optional TP"
                  className={`w-full px-3.5 py-2.5 text-sm font-bold font-mono bg-slate-50/90 hover:bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all text-slate-900 shadow-2xs ${
                    validationError && validationError.includes("TP")
                      ? "border-rose-400 focus:ring-rose-500/20 focus:border-rose-600 text-rose-900"
                      : "border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-600"
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold uppercase">
                  TP Price
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">
                Auto-calculated from 1:{numericRR} RR
              </span>
            </div>
          </div>

          {/* Dynamic Risk vs Reward Summary Card */}
          <div className="grid grid-cols-2 gap-3">
            {/* Risk Box */}
            <div className="p-3.5 bg-linear-to-br from-rose-50/90 to-rose-50/40 border border-rose-200/90 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider block">
                Risk (Max Loss)
              </span>
              <div className="text-lg font-extrabold font-mono text-rose-700 tracking-tight">
                -{expectedLossAcc.toFixed(2)} <span className="text-xs font-semibold">{currencyUnit}</span>
              </div>
              <div className="text-[10px] font-mono text-rose-600">
                -${expectedLossUSD.toFixed(2)} USD (-৳{expectedLossBDT.toFixed(0)})
              </div>
            </div>

            {/* Reward Box */}
            <div className="p-3.5 bg-linear-to-br from-emerald-50/90 to-emerald-50/40 border border-emerald-200/90 rounded-2xl space-y-1 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                Reward Target (1:{numericRR})
              </span>
              <div className="text-lg font-extrabold font-mono text-emerald-700 tracking-tight">
                +{expectedRewardAcc.toFixed(2)} <span className="text-xs font-semibold">{currencyUnit}</span>
              </div>
              <div className="text-[10px] font-mono text-emerald-600">
                +${expectedRewardUSD.toFixed(2)} USD (+৳{expectedRewardBDT.toFixed(0)})
              </div>
            </div>
          </div>

          {/* Suggested Risk Indicator Banner (Non-intrusive) */}
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between text-xs font-mono shadow-2xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-800 block">
                  Suggested Risk: <span className="text-indigo-600">${tierRisk.toFixed(2)} USD</span>
                </span>
                <span className="text-[10px] text-slate-500 font-sans">
                  Framework: {tierStepName} ({tierMode})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleApplyTierRisk}
              className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase transition-colors shadow-2xs cursor-pointer active:scale-95"
              title="Calibrate SL to match suggested risk"
            >
              Apply Risk
            </button>
          </div>

          {/* Key Metrics: Volume in USD, Volume in BDT, Est Margin, Spread */}
          <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-3 font-mono text-xs shadow-2xs">
            {/* Volume in USD & BDT */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">
                Notional Volume (USD):
              </span>
              <span className="font-bold text-slate-900 text-sm">
                ${volUSD.toFixed(2)} USD
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-linear-to-r from-indigo-50/80 to-indigo-50/40 border border-indigo-100">
              <span className="text-indigo-900 font-semibold text-[11px] uppercase tracking-wide">
                Volume in BDT:
              </span>
              <span className="font-extrabold text-indigo-700 text-base">
                ৳{volBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Margin and Spread */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">
                  Est. Margin
                </span>
                <span className="font-bold text-slate-800">
                  {isCent
                    ? `${estMarginRaw.toFixed(2)} USC`
                    : `$${estMarginUSD.toFixed(2)}`}
                </span>
                <span className="text-slate-400 block text-[10px]">
                  (৳{estMarginBDT.toLocaleString("en-US", { maximumFractionDigits: 0 })})
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block uppercase text-[10px] font-semibold">
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

          {/* Execute Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={executing || tradeSuccess !== null || !!validationError}
              onClick={handleExecute}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm font-mono shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
                tradeType === "BUY"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
              }`}
            >
              {executing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting Order to MT5...</span>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span>
                    Execute {tradeType} {numericLots} Lots (1:{numericRR} RR)
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
