import MetaTrader5 as mt5
from datetime import datetime, timedelta
from collections import defaultdict
from services.position_service import _calc_volume_usd


def _categorize_symbol(symbol: str) -> str:
    s = symbol.upper()
    if any(k in s for k in ["US30", "USTEC", "US500", "DE30", "JP225", "NAS100", "SPX500", "GER40"]):
        return "Indices"
    elif any(k in s for k in ["XAU", "XAG", "GOLD", "SILVER", "OIL", "USOIL", "UKOIL"]):
        return "Commodities"
    elif any(k in s for k in ["BTC", "ETH", "SOL", "XRP"]):
        return "Crypto"
    else:
        return "Forex"


def get_portfolio_analytics():
    """
    Computes comprehensive portfolio intelligence:
    - Account equity, balance, margin utilization, free capital
    - Growth trajectory (cumulative equity points over time)
    - Peak balance & Historical maximum drawdown %
    - Asset allocation & Long vs Short directional exposure
    - Category diversification (Forex, Indices, Commodities, Crypto)
    - Active holdings with weight % and live return
    - Symbol-by-symbol historical profitability breakdown
    """
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        account = mt5.account_info()
        if not account:
            raise RuntimeError(f"MT5 account info unavailable: {mt5.last_error()}")

        account_dict = account._asdict()
        currency = account_dict.get("currency", "USD")
        is_cent = currency == "USC"
        bdt_rate = 120.0

        balance_acc = float(account_dict.get("balance", 0.0))
        equity_acc = float(account_dict.get("equity", 0.0))
        margin_acc = float(account_dict.get("margin", 0.0))
        margin_free_acc = float(account_dict.get("margin_free", 0.0))
        margin_level = float(account_dict.get("margin_level", 0.0))
        profit_acc = float(account_dict.get("profit", 0.0))

        balance_usd = round((balance_acc / 100.0) if is_cent else balance_acc, 2)
        balance_bdt = round(balance_usd * bdt_rate, 2)
        equity_usd = round((equity_acc / 100.0) if is_cent else equity_acc, 2)
        equity_bdt = round(equity_usd * bdt_rate, 2)

        margin_usd = round((margin_acc / 100.0) if is_cent else margin_acc, 2)
        margin_bdt = round(margin_usd * bdt_rate, 2)
        margin_free_usd = round((margin_free_acc / 100.0) if is_cent else margin_free_acc, 2)
        margin_free_bdt = round(margin_free_usd * bdt_rate, 2)

        profit_usd = round((profit_acc / 100.0) if is_cent else profit_acc, 2)
        profit_bdt = round(profit_usd * bdt_rate, 2)

        margin_used_pct = round((margin_acc / equity_acc * 100.0), 1) if equity_acc > 0 else 0.0
        free_capital_pct = max(0.0, round(100.0 - margin_used_pct, 1))

        # 1. Active Open Positions & Exposure Breakdown
        raw_positions = mt5.positions_get() or ()
        holdings = []
        total_vol_usd = 0.0
        total_lots = 0.0
        long_vol_usd = 0.0
        short_vol_usd = 0.0

        for p in raw_positions:
            p_dict = p._asdict()
            sym = p_dict["symbol"]
            lots = float(p_dict["volume"])
            price_current = float(p_dict["price_current"])
            pos_type = "BUY" if p_dict["type"] == mt5.POSITION_TYPE_BUY else "SELL"
            p_profit_acc = float(p_dict["profit"])
            p_profit_usd = (p_profit_acc / 100.0) if is_cent else p_profit_acc

            vol_usd = _calc_volume_usd(sym, lots, price_current)
            total_vol_usd += vol_usd
            total_lots += lots

            if pos_type == "BUY":
                long_vol_usd += vol_usd
            else:
                short_vol_usd += vol_usd

            holdings.append({
                "ticket": p_dict["ticket"],
                "symbol": sym,
                "category": _categorize_symbol(sym),
                "type": pos_type,
                "volume": lots,
                "volume_usd": round(vol_usd, 2),
                "volume_bdt": round(vol_usd * bdt_rate, 2),
                "price_open": float(p_dict["price_open"]),
                "price_current": price_current,
                "profit": round(p_profit_acc, 2),
                "profit_usd": round(p_profit_usd, 2),
                "profit_bdt": round(p_profit_usd * bdt_rate, 2),
                "return_pct": round((p_profit_usd / vol_usd * 100.0), 2) if vol_usd > 0 else 0.0,
                "time": datetime.fromtimestamp(p_dict["time"]).strftime("%Y-%m-%d %H:%M:%S")
            })

        # Calculate weight percentage for each holding
        for h in holdings:
            h["weight_pct"] = round((h["volume_usd"] / total_vol_usd * 100.0), 1) if total_vol_usd > 0 else 0.0

        long_pct = round((long_vol_usd / total_vol_usd * 100.0), 1) if total_vol_usd > 0 else 0.0
        short_pct = round((short_vol_usd / total_vol_usd * 100.0), 1) if total_vol_usd > 0 else 0.0

        # Category Allocation
        cat_alloc_usd = defaultdict(float)
        for h in holdings:
            cat_alloc_usd[h["category"]] += h["volume_usd"]

        category_allocation = []
        for cat, val in cat_alloc_usd.items():
            pct = round((val / total_vol_usd * 100.0), 1) if total_vol_usd > 0 else 0.0
            category_allocation.append({
                "category": cat,
                "volume_usd": round(val, 2),
                "volume_bdt": round(val * bdt_rate, 2),
                "pct": pct
            })

        # 2. Historical Deals & Growth Curve Trajectory
        now = datetime.now()
        from_date = now - timedelta(days=90)
        deals = mt5.history_deals_get(from_date, now) or ()

        trade_deals = [d for d in deals if d.entry == 1 and d.symbol]
        trade_deals.sort(key=lambda d: d.time)

        growth_curve = []
        running_cum_profit = 0.0
        peak_profit = 0.0
        max_drawdown_acc = 0.0

        # Symbol historical performance accumulator
        symbol_history = defaultdict(lambda: {
            "symbol": "",
            "category": "",
            "trades": 0,
            "wins": 0,
            "losses": 0,
            "profit_acc": 0.0,
            "lots": 0.0
        })

        for d in trade_deals:
            deal_profit = round(d.profit + d.swap + d.commission, 2)
            running_cum_profit += deal_profit

            if running_cum_profit > peak_profit:
                peak_profit = running_cum_profit
            drawdown_val = peak_profit - running_cum_profit
            if drawdown_val > max_drawdown_acc:
                max_drawdown_acc = drawdown_val

            dt_str = datetime.fromtimestamp(d.time).strftime("%m-%d %H:%M")
            deal_profit_usd = round((deal_profit / 100.0) if is_cent else deal_profit, 2)
            cum_profit_usd = round((running_cum_profit / 100.0) if is_cent else running_cum_profit, 2)

            growth_curve.append({
                "time": dt_str,
                "profit": deal_profit,
                "profit_usd": deal_profit_usd,
                "cum_profit": round(running_cum_profit, 2),
                "cum_profit_usd": cum_profit_usd,
                "cum_profit_bdt": round(cum_profit_usd * bdt_rate, 2),
            })

            # Accumulate symbol stats
            s_stat = symbol_history[d.symbol]
            s_stat["symbol"] = d.symbol
            s_stat["category"] = _categorize_symbol(d.symbol)
            s_stat["trades"] += 1
            s_stat["lots"] += round(d.volume, 2)
            s_stat["profit_acc"] += deal_profit
            if deal_profit > 0:
                s_stat["wins"] += 1
            elif deal_profit < 0:
                s_stat["losses"] += 1

        # Format symbol breakdown list
        symbol_performance = []
        for sym, s_data in symbol_history.items():
            t_count = s_data["trades"]
            wr = round((s_data["wins"] / t_count * 100.0), 1) if t_count > 0 else 0.0
            p_acc = round(s_data["profit_acc"], 2)
            p_usd = round((p_acc / 100.0) if is_cent else p_acc, 2)
            symbol_performance.append({
                "symbol": sym,
                "category": s_data["category"],
                "trades": t_count,
                "win_rate": wr,
                "lots": round(s_data["lots"], 2),
                "profit": p_acc,
                "profit_usd": p_usd,
                "profit_bdt": round(p_usd * bdt_rate, 2)
            })

        symbol_performance.sort(key=lambda x: x["profit"], reverse=True)

        # Max drawdown metrics
        max_drawdown_usd = round((max_drawdown_acc / 100.0) if is_cent else max_drawdown_acc, 2)
        max_drawdown_bdt = round(max_drawdown_usd * bdt_rate, 2)
        drawdown_pct = round((max_drawdown_acc / (balance_acc + max_drawdown_acc) * 100.0), 1) if (balance_acc + max_drawdown_acc) > 0 else 0.0

        return {
            "account": {
                "login": account_dict.get("login"),
                "name": account_dict.get("name"),
                "server": account_dict.get("server"),
                "currency": currency,
                "is_cent": is_cent,
                "balance": balance_acc,
                "balance_usd": balance_usd,
                "balance_bdt": balance_bdt,
                "equity": equity_acc,
                "equity_usd": equity_usd,
                "equity_bdt": equity_bdt,
                "margin": margin_acc,
                "margin_usd": margin_usd,
                "margin_bdt": margin_bdt,
                "margin_free": margin_free_acc,
                "margin_free_usd": margin_free_usd,
                "margin_free_bdt": margin_free_bdt,
                "margin_level": margin_level,
                "margin_used_pct": margin_used_pct,
                "free_capital_pct": free_capital_pct,
                "floating_profit": profit_acc,
                "floating_profit_usd": profit_usd,
                "floating_profit_bdt": profit_bdt,
            },
            "exposure": {
                "total_volume_usd": round(total_vol_usd, 2),
                "total_volume_bdt": round(total_vol_usd * bdt_rate, 2),
                "total_lots": round(total_lots, 2),
                "long_volume_usd": round(long_vol_usd, 2),
                "long_volume_bdt": round(long_vol_usd * bdt_rate, 2),
                "long_pct": long_pct,
                "short_volume_usd": round(short_vol_usd, 2),
                "short_volume_bdt": round(short_vol_usd * bdt_rate, 2),
                "short_pct": short_pct,
                "active_count": len(holdings)
            },
            "drawdown": {
                "max_drawdown_acc": round(max_drawdown_acc, 2),
                "max_drawdown_usd": max_drawdown_usd,
                "max_drawdown_bdt": max_drawdown_bdt,
                "drawdown_pct": drawdown_pct,
                "peak_profit_acc": round(peak_profit, 2),
            },
            "holdings": holdings,
            "category_allocation": category_allocation,
            "growth_curve": growth_curve,
            "symbol_performance": symbol_performance
        }

    finally:
        mt5.shutdown()
