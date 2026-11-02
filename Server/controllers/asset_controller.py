from services.asset_service import (
    get_all_assets,
    get_my_assets,
    toggle_tracked_asset,
    update_chart_link,
    update_trend_status,
)


def all_assets_controller(payload=None):
    return {
        "success": True,
        "data": get_all_assets()
    }


def tracked_assets_controller(payload=None):
    return {
        "success": True,
        "data": get_my_assets()
    }


def toggle_asset_controller(payload=None):
    if not payload or "symbol" not in payload:
        raise ValueError("Missing 'symbol' in request payload")

    symbol = payload.get("symbol")
    name = payload.get("name", "")
    chart_link = payload.get("chart_link")
    trend_status = payload.get("trend_status")

    result = toggle_tracked_asset(symbol, name, chart_link, trend_status)
    return {
        "success": True,
        "data": result
    }


def update_chart_link_controller(payload=None):
    if not payload or "symbol" not in payload:
        raise ValueError("Missing 'symbol' in request payload")

    symbol = payload.get("symbol")
    chart_link = payload.get("chart_link", "")

    result = update_chart_link(symbol, chart_link)
    return {
        "success": True,
        "data": result
    }


def update_trend_status_controller(payload=None):
    if not payload or "symbol" not in payload:
        raise ValueError("Missing 'symbol' in request payload")

    symbol = payload.get("symbol")
    trend_status = payload.get("trend_status", "NEUTRAL")

    result = update_trend_status(symbol, trend_status)
    return {
        "success": True,
        "data": result
    }
