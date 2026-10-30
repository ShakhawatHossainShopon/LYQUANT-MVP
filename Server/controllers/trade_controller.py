from services.trade_service import open_trade, calc_trade_specs


def open_trade_controller(payload=None):
    if not payload:
        raise ValueError("Missing payload for trade execution")

    symbol = payload.get("symbol")
    order_type = payload.get("type", "BUY").upper()
    lots = float(payload.get("lots", 0.01))
    sl = float(payload.get("sl", 0.0))
    tp = float(payload.get("tp", 0.0))
    comment = payload.get("comment", "LYQUANT Web")

    if not symbol:
        raise ValueError("Symbol is required")
    if order_type not in ("BUY", "SELL"):
        raise ValueError("Order type must be 'BUY' or 'SELL'")
    if lots <= 0:
        raise ValueError("Lot size must be greater than 0")

    result = open_trade(symbol, order_type, lots, sl, tp, comment)
    return {
        "success": True,
        "message": f"{order_type} {lots} lots of {symbol} executed successfully",
        "data": result
    }


def calc_trade_controller(payload=None):
    if not payload or "symbol" not in payload:
        raise ValueError("Symbol is required to calculate trade specs")

    symbol = payload.get("symbol")
    lots = float(payload.get("lots", 0.01))

    specs = calc_trade_specs(symbol, lots)
    return {
        "success": True,
        "data": specs
    }
