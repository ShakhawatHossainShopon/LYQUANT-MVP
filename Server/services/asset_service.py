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
                chart_link TEXT DEFAULT '',
                trend_status TEXT DEFAULT 'NEUTRAL',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Ensure chart_link and trend_status columns exist if table was created previously
        cursor = conn.execute("PRAGMA table_info(tracked_assets)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "chart_link" not in columns:
            conn.execute("ALTER TABLE tracked_assets ADD COLUMN chart_link TEXT DEFAULT ''")
        if "trend_status" not in columns:
            conn.execute("ALTER TABLE tracked_assets ADD COLUMN trend_status TEXT DEFAULT 'NEUTRAL'")
        conn.commit()


# Initialize table on import
_init_db()


def get_tracked_symbols():
    with _get_db() as conn:
        cursor = conn.execute("SELECT symbol FROM tracked_assets ORDER BY created_at DESC")
        return [row["symbol"] for row in cursor.fetchall()]


def get_tracked_dict():
    with _get_db() as conn:
        cursor = conn.execute("SELECT symbol, name, chart_link, trend_status FROM tracked_assets ORDER BY created_at DESC")
        return {
            row["symbol"]: {
                "name": row["name"],
                "chart_link": row["chart_link"] or "",
                "trend_status": row["trend_status"] or "NEUTRAL",
            }
            for row in cursor.fetchall()
        }


def toggle_tracked_asset(symbol, name="", chart_link=None, trend_status=None):
    if not symbol:
        raise ValueError("Symbol is required")

    with _get_db() as conn:
        cursor = conn.execute("SELECT symbol, chart_link, trend_status FROM tracked_assets WHERE symbol = ?", (symbol,))
        exists = cursor.fetchone()

        if exists:
            # If chart_link or trend_status is provided, update rather than deleting
            if chart_link is not None or trend_status is not None:
                updates = []
                params = []
                if chart_link is not None:
                    updates.append("chart_link = ?")
                    params.append(chart_link.strip())
                if trend_status is not None:
                    updates.append("trend_status = ?")
                    params.append(trend_status.strip().upper())
                params.append(symbol)
                conn.execute(f"UPDATE tracked_assets SET {', '.join(updates)} WHERE symbol = ?", params)
                conn.commit()
                return {
                    "symbol": symbol,
                    "is_tracked": True,
                    "chart_link": chart_link.strip() if chart_link is not None else exists["chart_link"],
                    "trend_status": trend_status.strip().upper() if trend_status is not None else exists["trend_status"],
                }
            else:
                conn.execute("DELETE FROM tracked_assets WHERE symbol = ?", (symbol,))
                conn.commit()
                return {"symbol": symbol, "is_tracked": False, "chart_link": "", "trend_status": "NEUTRAL"}
        else:
            link_val = (chart_link or "").strip()
            status_val = (trend_status or "NEUTRAL").strip().upper()
            conn.execute(
                "INSERT INTO tracked_assets (symbol, name, chart_link, trend_status) VALUES (?, ?, ?, ?)",
                (symbol, name or symbol, link_val, status_val),
            )
            conn.commit()
            return {"symbol": symbol, "is_tracked": True, "chart_link": link_val, "trend_status": status_val}


def update_chart_link(symbol, chart_link=""):
    if not symbol:
        raise ValueError("Symbol is required")

    link_val = (chart_link or "").strip()
    with _get_db() as conn:
        conn.execute("UPDATE tracked_assets SET chart_link = ? WHERE symbol = ?", (link_val, symbol))
        conn.commit()
    return {"symbol": symbol, "chart_link": link_val}


def update_trend_status(symbol, trend_status="NEUTRAL"):
    if not symbol:
        raise ValueError("Symbol is required")

    status_val = (trend_status or "NEUTRAL").strip().upper()
    valid_statuses = ("UPTREND", "DOWNTREND", "NEUTRAL")
    if status_val not in valid_statuses:
        status_val = "NEUTRAL"

    with _get_db() as conn:
        conn.execute("UPDATE tracked_assets SET trend_status = ? WHERE symbol = ?", (status_val, symbol))
        conn.commit()
    return {"symbol": symbol, "trend_status": status_val}


def get_all_assets():
    tracked_map = get_tracked_dict()

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

            is_tracked = s.name in tracked_map
            chart_link = tracked_map[s.name]["chart_link"] if is_tracked else ""
            trend_status = tracked_map[s.name]["trend_status"] if is_tracked else "NEUTRAL"

            asset_list.append({
                "symbol": s.name,
                "description": s.description or s.name,
                "bid": bid,
                "ask": ask,
                "digits": s.digits,
                "spread_points": s.spread,
                "spread_pips": spread_pips,
                "is_tracked": is_tracked,
                "chart_link": chart_link,
                "trend_status": trend_status,
                "is_market_watch": bool(s.visible or s.select),
            })

        # Sort: Market watch items first, then alphabetical
        asset_list.sort(key=lambda x: (not x["is_market_watch"], x["symbol"]))
        return asset_list

    finally:
        mt5.shutdown()


def get_my_assets():
    tracked_map = get_tracked_dict()
    if not tracked_map:
        return []

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialization failed: {mt5.last_error()}")

    try:
        tracked_assets = []
        for symbol, info in tracked_map.items():
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
                "chart_link": info.get("chart_link", ""),
                "trend_status": info.get("trend_status", "NEUTRAL"),
                "is_tracked": True,
            })

        return tracked_assets

    finally:
        mt5.shutdown()
