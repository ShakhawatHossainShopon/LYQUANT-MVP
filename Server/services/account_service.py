import MetaTrader5 as mt5
from services.mt5_service import get_account
from services.position_service import _calc_volume_usd


def get_account_details():
    account = get_account()

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        positions = mt5.positions_get()

        if positions is None:
            raise RuntimeError(f"Failed to fetch positions: {mt5.last_error()}")

        total_volume_usd = 0.0

        for position in positions:
            price = getattr(position, "price_current", getattr(position, "price_open", 0.0))
            position_value = _calc_volume_usd(position.symbol, float(position.volume), price)
            total_volume_usd += position_value

        account["trading_volume"] = round(total_volume_usd, 2)
        account["cfd_exposure_usd"] = round(total_volume_usd, 2)
        account["total_positions"] = len(positions)

        return account

    finally:
        mt5.shutdown()
