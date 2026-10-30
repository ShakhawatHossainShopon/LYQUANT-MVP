
import MetaTrader5 as mt5


def test_services(symbol: str, lot_size: float):

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        info = mt5.symbol_info(symbol)

        if info is None:
            raise RuntimeError(f"Symbol not found: {symbol}")

        if lot_size < info.volume_min or lot_size > info.volume_max:
            raise ValueError("Lot size outside allowed limits")

        if round(lot_size / info.volume_step) * info.volume_step != lot_size:
            raise ValueError("Invalid lot size step")

        tick = mt5.symbol_info_tick(symbol)

        if tick is None:
            raise RuntimeError("Failed to fetch market price")

        price = (tick.bid + tick.ask) / 2

        contract_size = info.trade_contract_size

        total_units = lot_size * contract_size

        position_value = total_units * price

        return {
            "symbol": symbol,
            "lot_size": lot_size,
            "contract_size_per_lot": contract_size,
            "total_units": total_units,
            "market_price": price,
            "total_position_value": round(position_value, 2)
        }

    finally:
        mt5.shutdown()
