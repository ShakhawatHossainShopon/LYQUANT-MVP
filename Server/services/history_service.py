import MetaTrader5 as mt5
from datetime import datetime, timedelta
from collections import defaultdict


def _format_duration(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    rem_seconds = seconds % 60
    if minutes < 60:
        return f"{minutes}m {rem_seconds}s" if rem_seconds else f"{minutes}m"
    hours = minutes // 60
    rem_minutes = minutes % 60
    return f"{hours}h {rem_minutes}m"


def get_trading_history(days: int = 90):
    """
    Retrieves completed trade history from MT5 and calculates key quantitative metrics:
    Win Rate, Profit Factor, Risk to Reward Ratio, Gross Profit/Loss, Best/Worst trade.
    """
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        account = mt5.account_info()
        currency = account.currency if account else "USD"
        is_cent = currency == "USC"
        bdt_rate = 120.0

        now = datetime.now()
        from_date = now - timedelta(days=days)

        deals = mt5.history_deals_get(from_date, now)
        if deals is None:
            deals = ()

        # Group deals by position_id
        pos_map = defaultdict(list)
        for d in deals:
            # Filter out non-trade balance operations
            if d.symbol and d.position_id:
                pos_map[d.position_id].append(d)

        closed_trades = []

        for pid, d_list in pos_map.items():
            in_deals = [d for d in d_list if d.entry == 0]
            out_deals = [d for d in d_list if d.entry == 1]

            if in_deals and out_deals:
                in_deal = in_deals[0]
                out_deal = out_deals[-1]

                profit_acc = round(sum(d.profit + d.swap + d.commission for d in d_list), 2)
                profit_usd = round((profit_acc / 100.0) if is_cent else profit_acc, 2)
                profit_bdt = round(profit_usd * bdt_rate, 2)

                open_ts = in_deal.time
                close_ts = out_deal.time
                duration_sec = max(0, close_ts - open_ts)

                open_time_str = datetime.fromtimestamp(open_ts).strftime("%Y-%m-%d %H:%M:%S")
                close_time_str = datetime.fromtimestamp(close_ts).strftime("%Y-%m-%d %H:%M:%S")

                pos_type = "BUY" if in_deal.type == mt5.DEAL_TYPE_BUY else "SELL"

                closed_trades.append({
                    "position_id": pid,
                    "symbol": in_deal.symbol,
                    "type": pos_type,
                    "volume": round(in_deal.volume, 2),
                    "open_price": in_deal.price,
                    "close_price": out_deal.price,
                    "open_time": open_time_str,
                    "close_time": close_time_str,
                    "open_timestamp": open_ts,
                    "close_timestamp": close_ts,
                    "duration_sec": duration_sec,
                    "duration_str": _format_duration(duration_sec),
                    "profit": profit_acc,
                    "profit_usd": profit_usd,
                    "profit_bdt": profit_bdt,
                    "is_win": profit_acc > 0,
                    "is_loss": profit_acc < 0,
                    "is_breakeven": profit_acc == 0,
                    "comment": out_deal.comment or in_deal.comment or ""
                })

        # Sort trades by close time descending (most recent first)
        closed_trades.sort(key=lambda x: x["close_timestamp"], reverse=True)

        total_trades = len(closed_trades)
        wins = [t for t in closed_trades if t["is_win"]]
        losses = [t for t in closed_trades if t["is_loss"]]
        breakevens = [t for t in closed_trades if t["is_breakeven"]]

        winning_count = len(wins)
        losing_count = len(losses)
        breakeven_count = len(breakevens)

        win_rate = round((winning_count / total_trades * 100), 1) if total_trades > 0 else 0.0
        loss_rate = round((losing_count / total_trades * 100), 1) if total_trades > 0 else 0.0

        gross_profit_acc = round(sum(t["profit"] for t in wins), 2)
        gross_loss_acc = round(abs(sum(t["profit"] for t in losses)), 2)
        net_profit_acc = round(gross_profit_acc - gross_loss_acc, 2)

        gross_profit_usd = round(sum(t["profit_usd"] for t in wins), 2)
        gross_loss_usd = round(abs(sum(t["profit_usd"] for t in losses)), 2)
        net_profit_usd = round(gross_profit_usd - gross_loss_usd, 2)

        gross_profit_bdt = round(gross_profit_usd * bdt_rate, 2)
        gross_loss_bdt = round(gross_loss_usd * bdt_rate, 2)
        net_profit_bdt = round(net_profit_usd * bdt_rate, 2)

        profit_factor = round(gross_profit_acc / gross_loss_acc, 2) if gross_loss_acc > 0 else (99.0 if gross_profit_acc > 0 else 0.0)

        avg_win_acc = round(gross_profit_acc / winning_count, 2) if winning_count > 0 else 0.0
        avg_loss_acc = round(gross_loss_acc / losing_count, 2) if losing_count > 0 else 0.0

        avg_win_usd = round(gross_profit_usd / winning_count, 2) if winning_count > 0 else 0.0
        avg_loss_usd = round(gross_loss_usd / losing_count, 2) if losing_count > 0 else 0.0

        avg_win_bdt = round(avg_win_usd * bdt_rate, 2)
        avg_loss_bdt = round(avg_loss_usd * bdt_rate, 2)

        risk_reward_ratio = round(avg_win_acc / avg_loss_acc, 2) if avg_loss_acc > 0 else (99.0 if avg_win_acc > 0 else 0.0)

        best_trade = max(closed_trades, key=lambda x: x["profit"]) if closed_trades else None
        worst_trade = min(closed_trades, key=lambda x: x["profit"]) if closed_trades else None

        total_volume_lots = round(sum(t["volume"] for t in closed_trades), 2)

        return {
            "currency": currency,
            "is_cent": is_cent,
            "metrics": {
                "total_trades": total_trades,
                "winning_trades": winning_count,
                "losing_trades": losing_count,
                "breakeven_trades": breakeven_count,
                "win_rate": win_rate,
                "loss_rate": loss_rate,
                "profit_factor": profit_factor,
                "risk_reward_ratio": risk_reward_ratio,
                "net_profit": net_profit_acc,
                "net_profit_usd": net_profit_usd,
                "net_profit_bdt": net_profit_bdt,
                "gross_profit": gross_profit_acc,
                "gross_profit_usd": gross_profit_usd,
                "gross_profit_bdt": gross_profit_bdt,
                "gross_loss": gross_loss_acc,
                "gross_loss_usd": gross_loss_usd,
                "gross_loss_bdt": gross_loss_bdt,
                "avg_win": avg_win_acc,
                "avg_win_usd": avg_win_usd,
                "avg_win_bdt": avg_win_bdt,
                "avg_loss": avg_loss_acc,
                "avg_loss_usd": avg_loss_usd,
                "avg_loss_bdt": avg_loss_bdt,
                "total_volume_lots": total_volume_lots,
                "best_trade": best_trade,
                "worst_trade": worst_trade,
            },
            "trades": closed_trades
        }

    finally:
        mt5.shutdown()
