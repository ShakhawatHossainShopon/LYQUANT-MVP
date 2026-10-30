import MetaTrader5 as mt5


def close_position(ticket: int):
    """
    Closes an active MT5 position given its ticket.
    Dispatches a market order of the opposite direction.
    """
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        positions = mt5.positions_get(ticket=int(ticket))
        if not positions:
            raise ValueError(f"Position #{ticket} not found or already closed in MT5")

        pos = positions[0]
        symbol = pos.symbol
        symbol_info = mt5.symbol_info(symbol)
        if not symbol_info:
            raise ValueError(f"Symbol '{symbol}' not found in MT5")

        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            raise RuntimeError(f"Failed to fetch market tick for {symbol}")

        is_buy = pos.type == mt5.POSITION_TYPE_BUY
        order_type = mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY
        price = tick.bid if is_buy else tick.ask

        filling_mode = symbol_info.filling_mode
        if filling_mode & 2:
            type_filling = mt5.ORDER_FILLING_IOC
        elif filling_mode & 1:
            type_filling = mt5.ORDER_FILLING_FOK
        else:
            type_filling = mt5.ORDER_FILLING_RETURN

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "position": int(ticket),
            "symbol": symbol,
            "volume": float(pos.volume),
            "type": order_type,
            "price": float(price),
            "deviation": 20,
            "magic": 202610,
            "comment": "LYQUANT Exit",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": type_filling,
        }

        check_res = mt5.order_check(request)
        if check_res is None or check_res.retcode != 0:
            err = check_res.comment if check_res else mt5.last_error()
            raise RuntimeError(f"Close check failed: {err}")

        result = mt5.order_send(request)
        if result is None:
            raise RuntimeError(f"Close order send failed: {mt5.last_error()}")

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise RuntimeError(f"Broker rejected close: {result.comment} (code {result.retcode})")

        return {
            "ticket": ticket,
            "closed_deal": result.deal,
            "closed_order": result.order,
            "price": result.price,
            "volume": result.volume,
            "comment": result.comment,
            "symbol": symbol,
        }

    finally:
        mt5.shutdown()


def close_all_positions():
    """
    Closes all active open positions in the MT5 terminal.
    """
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        positions = mt5.positions_get()
        if not positions:
            return {"closed": [], "total": 0, "message": "No active open positions to close."}

        results = []
        for pos in positions:
            try:
                symbol = pos.symbol
                symbol_info = mt5.symbol_info(symbol)
                tick = mt5.symbol_info_tick(symbol)
                if not symbol_info or not tick:
                    continue

                is_buy = pos.type == mt5.POSITION_TYPE_BUY
                order_type = mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY
                price = tick.bid if is_buy else tick.ask

                filling_mode = symbol_info.filling_mode
                if filling_mode & 2:
                    type_filling = mt5.ORDER_FILLING_IOC
                elif filling_mode & 1:
                    type_filling = mt5.ORDER_FILLING_FOK
                else:
                    type_filling = mt5.ORDER_FILLING_RETURN

                request = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "position": int(pos.ticket),
                    "symbol": symbol,
                    "volume": float(pos.volume),
                    "type": order_type,
                    "price": float(price),
                    "deviation": 20,
                    "magic": 202610,
                    "comment": "LYQUANT Exit All",
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": type_filling,
                }
                res = mt5.order_send(request)
                if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                    results.append({"ticket": pos.ticket, "symbol": symbol, "status": "closed", "price": res.price})
                else:
                    err = res.comment if res else "Unknown error"
                    results.append({"ticket": pos.ticket, "symbol": symbol, "status": "failed", "error": err})
            except Exception as e:
                results.append({"ticket": pos.ticket, "symbol": pos.symbol, "status": "failed", "error": str(e)})

        return {"closed": results, "total": len(results)}

    finally:
        mt5.shutdown()
