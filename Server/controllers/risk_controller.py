from services.risk_service import (
    get_engine_data,
    open_engine_trade,
    execute_engine_trade,
    delete_open_trade,
    reset_engine_database,
    update_engine_config,
    delete_engine_trade,
)


def risk_overview_controller(payload=None):
    """
    Returns engine data including open trades and stepped cushion status.
    """
    data = get_engine_data()
    return {
        "success": True,
        "data": data,
    }


def open_engine_trade_controller(payload=None):
    """
    Manually opens a trade with current suggested tier risk (or custom).
    """
    if not payload:
        payload = {}
    custom_risk = payload.get("risk")
    data = open_engine_trade(custom_risk)
    return {
        "success": True,
        "data": data,
        "message": "Trade opened in risk engine.",
    }


def execute_engine_trade_controller(payload=None):
    """
    Submits a win or loss (closes an open trade or executes direct PnL).
    """
    if not payload:
        payload = {}

    is_win = bool(payload.get("isWin", False))
    rr_ratio = float(payload.get("rrRatio")) if payload.get("rrRatio") is not None else None
    exact_enabled = bool(payload.get("exactEnabled", False))
    exact_pnl = float(payload.get("exactPnl", 0.0))
    open_trade_id = int(payload.get("openTradeId")) if payload.get("openTradeId") else None

    data = execute_engine_trade(
        is_win=is_win,
        rr_ratio=rr_ratio,
        exact_enabled=exact_enabled,
        exact_pnl=exact_pnl,
        open_trade_id=open_trade_id,
    )
    return {
        "success": True,
        "data": data,
    }


def delete_open_trade_controller(payload=None):
    """
    Cancels an open floating trade.
    """
    if not payload or "id" not in payload:
        raise ValueError("Missing trade 'id'")
    trade_id = int(payload.get("id"))
    data = delete_open_trade(trade_id)
    return {
        "success": True,
        "data": data,
        "message": "Open trade cancelled.",
    }


def reset_risk_framework_controller(payload=None):
    """
    Resets database.
    """
    res = reset_engine_database()
    return {
        "success": True,
        "data": res,
        "message": "Database successfully reset.",
    }


def update_risk_config_controller(payload=None):
    """
    Updates config.
    """
    if not payload or "config" not in payload:
        raise ValueError("Missing 'config' in payload")

    new_config = payload.get("config")
    res = update_engine_config(new_config)
    return {
        "success": True,
        "data": res,
        "message": "Configuration updated. Trade history reset.",
    }


def delete_engine_trade_controller(payload=None):
    """
    Deletes a closed history trade.
    """
    if not payload or "id" not in payload:
        raise ValueError("Missing 'id' in payload")

    trade_id = int(payload.get("id"))
    data = delete_engine_trade(trade_id)
    return {
        "success": True,
        "data": data,
        "message": "Trade deleted and balance recalculated.",
    }
