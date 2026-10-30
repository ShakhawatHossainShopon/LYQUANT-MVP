import MetaTrader5 as mt5


def _calc_volume_usd(symbol_info, lots, price):
    if not symbol_info:
        return 0.0

    contract_size = symbol_info.trade_contract_size or 100000.0
    units = lots * contract_size

    if symbol_info.currency_profit == "USD":
        return units * price
    elif symbol_info.currency_base == "USD":
        return units
    else:
        for base_pair in [f"{symbol_info.currency_base}USDc", f"{symbol_info.currency_base}USD"]:
            tick = mt5.symbol_info_tick(base_pair)
            if tick and tick.bid > 0:
                return units * tick.bid
        return units * price


def calc_trade_specs(symbol: str, lots: float = 0.01):
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        s = mt5.symbol_info(symbol)
        if not s:
            raise ValueError(f"Symbol {symbol} not found in MT5")

        tick = mt5.symbol_info_tick(symbol)
        bid = round(tick.bid, s.digits) if tick else round(s.bid, s.digits)
        ask = round(tick.ask, s.digits) if tick else round(s.ask, s.digits)

        # Spread in pips
        if s.digits in (3, 5):
            spread_pips = round(s.spread / 10.0, 1)
        else:
            spread_pips = round(s.spread * 1.0, 1)

        # Base notional volume in USD
        volume_usd = round(_calc_volume_usd(s, lots, ask), 2)

        # Estimated Margin
        account = mt5.account_info()
        is_cent = account.currency == "USC" if account else False

        margin_buy = mt5.order_calc_margin(mt5.ORDER_TYPE_BUY, symbol, lots, ask)
        est_margin = round(margin_buy, 2) if margin_buy is not None else 0.0
        est_margin_usd = round(est_margin / 100.0, 2) if is_cent else est_margin

        return {
            "symbol": symbol,
            "lots": lots,
            "bid": bid,
            "ask": ask,
            "digits": s.digits,
            "spread_pips": spread_pips,
            "spread_points": s.spread,
            "contract_size": s.trade_contract_size,
            "volume_usd": volume_usd,
            "est_margin": est_margin,
            "est_margin_usd": est_margin_usd,
            "is_cent": is_cent,
            "currency": account.currency if account else "USD",
        }

    finally:
        mt5.shutdown()


def open_trade(symbol: str, order_type: str, lots: float, sl: float = 0.0, tp: float = 0.0, comment: str = "LYQUANT"):
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        symbol_info = mt5.symbol_info(symbol)
        if not symbol_info:
            raise ValueError(f"Symbol '{symbol}' not found in MT5 terminal")

        if not symbol_info.visible:
            if not mt5.symbol_select(symbol, True):
                raise RuntimeError(f"Failed to enable symbol '{symbol}' in Market Watch")

        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            raise RuntimeError(f"Failed to fetch market tick for {symbol}")

        is_buy = order_type.upper() == "BUY"
        price = tick.ask if is_buy else tick.bid
        mt5_order_type = mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL

        # Filling mode resolution
        filling_mode = symbol_info.filling_mode
        if filling_mode & 2:
            type_filling = mt5.ORDER_FILLING_IOC
        elif filling_mode & 1:
            type_filling = mt5.ORDER_FILLING_FOK
        else:
            type_filling = mt5.ORDER_FILLING_RETURN

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(lots),
            "type": mt5_order_type,
            "price": price,
            "deviation": 20,
            "magic": 202610,
            "comment": comment or "LYQUANT Trade",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": type_filling,
        }

        if sl > 0:
            request["sl"] = float(sl)
        if tp > 0:
            request["tp"] = float(tp)

        # Pre-check order
        check_result = mt5.order_check(request)
        if check_result is None or check_result.retcode != 0:
            err_msg = check_result.comment if check_result else mt5.last_error()
            raise RuntimeError(f"Order check failed: {err_msg}")

        # Send order to broker
        result = mt5.order_send(request)
        if result is None:
            raise RuntimeError(f"Order dispatch failed: {mt5.last_error()}")

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise RuntimeError(f"Broker rejected trade: {result.comment} (code {result.retcode})")

        return {
            "ticket": result.order,
            "symbol": symbol,
            "type": order_type.upper(),
            "volume": result.volume,
            "price": result.price,
            "comment": result.comment,
        }

    finally:
        mt5.shutdown()
