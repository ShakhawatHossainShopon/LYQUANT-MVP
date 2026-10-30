import sqlite3
import os
import MetaTrader5 as mt5

# SQLite Database setup
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lyquant.db")


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tracked_assets (
                symbol TEXT PRIMARY KEY,
                name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


# Initialize table on import
_init_db()


def get_tracked_symbols():
    with _get_db() as conn:
        cursor = conn.execute("SELECT symbol FROM tracked_assets ORDER BY created_at DESC")
        return [row["symbol"] for row in cursor.fetchall()]


def toggle_tracked_asset(symbol, name=""):
    if not symbol:
        raise ValueError("Symbol is required")

    with _get_db() as conn:
        cursor = conn.execute("SELECT symbol FROM tracked_assets WHERE symbol = ?", (symbol,))
        exists = cursor.fetchone()

        if exists:
            conn.execute("DELETE FROM tracked_assets WHERE symbol = ?", (symbol,))
            conn.commit()
            return {"symbol": symbol, "is_tracked": False}
        else:
            conn.execute("INSERT INTO tracked_assets (symbol, name) VALUES (?, ?)", (symbol, name or symbol))
            conn.commit()
            return {"symbol": symbol, "is_tracked": True}


def get_all_assets():
    tracked_set = set(get_tracked_symbols())

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        symbols = mt5.symbols_get()
        if symbols is None:
            return []

        asset_list = []

        for s in symbols:
            # Only include tradeable symbols
            if s.trade_mode == mt5.SYMBOL_TRADE_MODE_DISABLED:
                continue

            tick = mt5.symbol_info_tick(s.name)
            bid = round(tick.bid, s.digits) if tick else round(s.bid, s.digits)
            ask = round(tick.ask, s.digits) if tick else round(s.ask, s.digits)

            # Spread in pips (for 3/5 digits, 1 pip = 10 points; otherwise 1 pip = 1 point)
            if s.digits in (3, 5):
                spread_pips = round(s.spread / 10.0, 1)
            else:
                spread_pips = round(s.spread * 1.0, 1)

            asset_list.append({
                "symbol": s.name,
                "description": s.description or s.name,
                "bid": bid,
                "ask": ask,
                "digits": s.digits,
                "spread_points": s.spread,
                "spread_pips": spread_pips,
                "is_tracked": s.name in tracked_set,
                "is_market_watch": bool(s.visible or s.select),
            })

        # Sort: Market watch items first, then alphabetical
        asset_list.sort(key=lambda x: (not x["is_market_watch"], x["symbol"]))
        return asset_list

    finally:
        mt5.shutdown()


def get_my_assets():
    tracked = get_tracked_symbols()
    if not tracked:
        return []

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        tracked_assets = []
        for symbol in tracked:
            s = mt5.symbol_info(symbol)
            if not s:
                continue

            tick = mt5.symbol_info_tick(symbol)
            bid = round(tick.bid, s.digits) if tick else round(s.bid, s.digits)
            ask = round(tick.ask, s.digits) if tick else round(s.ask, s.digits)

            if s.digits in (3, 5):
                spread_pips = round(s.spread / 10.0, 1)
            else:
                spread_pips = round(s.spread * 1.0, 1)

            tracked_assets.append({
                "symbol": s.name,
                "description": s.description or s.name,
                "bid": bid,
                "ask": ask,
                "digits": s.digits,
                "spread_points": s.spread,
                "spread_pips": spread_pips,
                "is_tracked": True,
            })

        return tracked_assets

    finally:
        mt5.shutdown()
