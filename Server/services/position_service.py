import MetaTrader5 as mt5
from datetime import datetime


def _calc_volume_usd(symbol, lots, price):
    symbol_info = mt5.symbol_info(symbol)
    if not symbol_info:
        return 0.0

    contract_size = symbol_info.trade_contract_size or 100000.0
    units = lots * contract_size

    if symbol_info.currency_profit == "USD":
        return units * price
    elif symbol_info.currency_base == "USD":
        return units
    else:
        # Cross pair: look for base + USDc or base + USD
        for base_pair in [f"{symbol_info.currency_base}USDc", f"{symbol_info.currency_base}USD"]:
            tick = mt5.symbol_info_tick(base_pair)
            if tick and tick.bid > 0:
                return units * tick.bid
        return units * price


def get_open_positions():
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        account = mt5.account_info()
        if account is None:
            raise RuntimeError(f"Account info unavailable: {mt5.last_error()}")

        account_dict = account._asdict()
        currency = account_dict.get("currency", "USD")
        is_cent = currency == "USC"

        raw_positions = mt5.positions_get()
        if raw_positions is None:
            raw_positions = ()

        positions_list = []
        total_lots = 0.0
        total_volume_usd = 0.0
        total_profit_acc = 0.0

        for pos in raw_positions:
            pos_dict = pos._asdict()
            symbol = pos_dict["symbol"]
            lots = float(pos_dict["volume"])
            price_open = float(pos_dict["price_open"])
            price_current = float(pos_dict["price_current"])
            pos_type = "BUY" if pos_dict["type"] == mt5.POSITION_TYPE_BUY else "SELL"

            # Profit in account currency (e.g. USC for Cent accounts)
            profit_acc = float(pos_dict["profit"])
            profit_usd = (profit_acc / 100.0) if is_cent else profit_acc

            # Volume in USD
            volume_usd = round(_calc_volume_usd(symbol, lots, price_current), 2)

            total_lots += lots
            total_volume_usd += volume_usd
            total_profit_acc += profit_acc

            # Real percentage return relative to base position volume
            return_pct = round((profit_usd / volume_usd * 100), 2) if volume_usd > 0 else 0.0

            time_str = datetime.fromtimestamp(pos_dict["time"]).strftime("%Y-%m-%d %H:%M:%S")

            symbol_info = mt5.symbol_info(symbol)
            contract_size = symbol_info.trade_contract_size if symbol_info else 100000.0

            positions_list.append({
                "ticket": pos_dict["ticket"],
                "time": time_str,
                "timestamp": pos_dict["time"],
                "symbol": symbol,
                "type": pos_type,
                "volume": lots,
                "contract_size": contract_size,
                "volume_usd": volume_usd,
                "price_open": price_open,
                "price_current": price_current,
                "sl": float(pos_dict["sl"]),
                "tp": float(pos_dict["tp"]),
                "profit": round(profit_acc, 2),
                "profit_usd": round(profit_usd, 2),
                "return_pct": return_pct,
                "swap": float(pos_dict["swap"]),
                "comment": pos_dict.get("comment", "")
            })

        total_profit_usd = (total_profit_acc / 100.0) if is_cent else total_profit_acc

        return {
            "account": {
                "login": account_dict.get("login"),
                "name": account_dict.get("name"),
                "server": account_dict.get("server"),
                "currency": currency,
                "currency_digits": account_dict.get("currency_digits", 2),
                "is_cent": is_cent,
                "balance": account_dict.get("balance"),
                "equity": account_dict.get("equity"),
                "margin": account_dict.get("margin"),
                "margin_free": account_dict.get("margin_free"),
                "margin_level": account_dict.get("margin_level"),
                "profit": account_dict.get("profit")
            },
            "summary": {
                "total_positions": len(positions_list),
                "total_lots": round(total_lots, 2),
                "total_volume_usd": round(total_volume_usd, 2),
                "total_profit": round(total_profit_acc, 2),
                "total_profit_usd": round(total_profit_usd, 2),
                "currency": currency,
                "is_cent": is_cent
            },
            "positions": positions_list
        }

    finally:
        mt5.shutdown()
