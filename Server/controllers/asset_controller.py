from services.asset_service import (
    get_all_assets,
    get_my_assets,
    toggle_tracked_asset,
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

    result = toggle_tracked_asset(symbol, name)
    return {
        "success": True,
        "data": result
    }
