import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lyquant.db")

DEFAULT_CONFIG = {
    "startBalance": 2000,
    "profitTarget": 2200,
    "terminalFloor": 1800,
    "winRate": 50,
    "rrRatio": 1.5,
    "profitTiers": [
        {"min": 2000, "max": 2080, "cushion": "+$80", "risk": 20},
        {"min": 2080, "max": 2140, "cushion": "+$60", "risk": 15},
        {"min": 2140, "max": 2180, "cushion": "+$40", "risk": 10},
        {"min": 2180, "max": 2200, "cushion": "+$20", "risk": 5},
    ],
    "ddTiers": [
        {"max": 2000, "min": 1920, "cushion": "-$80", "risk": 20},
        {"max": 1920, "min": 1860, "cushion": "-$60", "risk": 15},
        {"max": 1860, "min": 1820, "cushion": "-$40", "risk": 10},
        {"max": 1820, "min": 1800, "cushion": "-$20", "risk": 5},
    ],
}


def _get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    with _get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS risk_settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS risk_engine_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket INTEGER DEFAULT NULL,
                symbol TEXT DEFAULT NULL,
                mode TEXT NOT NULL,
                is_win INTEGER NOT NULL,
                risk REAL NOT NULL,
                pnl REAL NOT NULL,
                new_balance REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS risk_engine_open_trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket INTEGER DEFAULT NULL,
                symbol TEXT DEFAULT NULL,
                mode TEXT NOT NULL,
                tier_step INTEGER NOT NULL,
                risk REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


_init_db()


def get_risk_config():
    with _get_db() as conn:
        cur = conn.execute("SELECT value FROM risk_settings WHERE key = 'config'")
        row = cur.fetchone()
        if row and row["value"]:
            try:
                return json.loads(row["value"])
            except Exception:
                pass
        return DEFAULT_CONFIG


def save_risk_config(config_dict):
    with _get_db() as conn:
        val_str = json.dumps(config_dict)
        conn.execute(
            """
            INSERT INTO risk_settings (key, value, updated_at)
            VALUES ('config', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            """,
            (val_str,),
        )
        conn.commit()
    return config_dict


def get_balance():
    cfg = get_risk_config()
    default_bal = float(cfg.get("startBalance", 2000))
    with _get_db() as conn:
        cur = conn.execute("SELECT value FROM risk_settings WHERE key = 'balance'")
        row = cur.fetchone()
        if row and row["value"] is not None:
            try:
                return float(json.loads(row["value"]))
            except Exception:
                pass
        return default_bal


def save_balance(balance_val):
    with _get_db() as conn:
        val_str = json.dumps(float(balance_val))
        conn.execute(
            """
            INSERT INTO risk_settings (key, value, updated_at)
            VALUES ('balance', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            """,
            (val_str,),
        )
        conn.commit()
    return balance_val


def get_open_trades():
    with _get_db() as conn:
        cur = conn.execute("SELECT * FROM risk_engine_open_trades ORDER BY id ASC")
        return [dict(r) for r in cur.fetchall()]


def _parse_cushion(cushion_val):
    if isinstance(cushion_val, (int, float)):
        return abs(float(cushion_val))
    if isinstance(cushion_val, str):
        cleaned = cushion_val.replace("+", "").replace("-", "").replace("$", "").strip()
        try:
            return abs(float(cleaned))
        except ValueError:
            return 80.0
    return 80.0


def calculate_tier_state(current_bal, open_trades, cfg):
    """
    Tier evaluation strictly driven by Engine Balance:
    - If current_bal >= startBalance: Profit Scaling Ladder (Step 1, Step 2, ...)
    - If current_bal < startBalance: Drawdown Defense Ladder (Step 1, Step 2, ...)

    Cushion depletion & dynamic next risk suggestion:
    - Active tier provides a cushion and a risk per trade.
    - Each open trade consumes risk from the active tier's cushion.
    - When consumed risk exhausts the tier's cushion, the engine suggests the next tier step's risk.
    """
    start_bal = float(cfg.get("startBalance", 2000))
    profit_tiers = cfg.get("profitTiers", [])
    dd_tiers = cfg.get("ddTiers", [])

    total_open_risk = sum(float(t["risk"]) for t in open_trades)
    effective_bal = current_bal - total_open_risk

    # 1. Base Tier is determined directly by current engine balance
    if current_bal >= start_bal:
        mode = "Profit Scaling"
        tier_type = "profit"
        active_ladder = profit_tiers
        step_prefix = "Profit Step"
        # Find step matching balance range
        base_step_index = 0
        for i, t in enumerate(profit_tiers):
            t_min = float(t.get("min", 0))
            t_max = float(t.get("max", 0))
            if current_bal >= t_min and current_bal <= t_max:
                base_step_index = i
                break
    else:
        mode = "Drawdown Defense"
        tier_type = "dd"
        active_ladder = dd_tiers
        step_prefix = "DD Step"
        # Find step matching balance range
        base_step_index = 0
        for i, t in enumerate(dd_tiers):
            t_max = float(t.get("max", 0))
            t_min = float(t.get("min", 0))
            if current_bal <= t_max and current_bal >= t_min:
                base_step_index = i
                break

    # 2. Stepping logic based on trade count:
    # Max trades allowed in this tier = floor(cushion / tier_risk)
    stepped_index = base_step_index
    if not active_ladder:
        active_ladder = [{"risk": 20, "cushion": 80}]

    current_tier_obj = active_ladder[stepped_index] if stepped_index < len(active_ladder) else active_ladder[-1]
    tier_cushion_max = _parse_cushion(current_tier_obj.get("cushion", 80))
    tier_risk_val = float(current_tier_obj.get("risk", 20))
    max_trades_in_tier = max(1, int(tier_cushion_max // tier_risk_val)) if tier_risk_val > 0 else 4

    # Count trades in the current stepped tier
    trades_in_tier_count = 0
    for _ in open_trades:
        trades_in_tier_count += 1
        if trades_in_tier_count >= max_trades_in_tier:
            # Tier capacity reached! Move to next tier step
            stepped_index = min(len(active_ladder) - 1, stepped_index + 1)
            current_tier_obj = active_ladder[stepped_index]
            tier_cushion_max = _parse_cushion(current_tier_obj.get("cushion", 60))
            tier_risk_val = float(current_tier_obj.get("risk", 15))
            max_trades_in_tier = max(1, int(tier_cushion_max // tier_risk_val)) if tier_risk_val > 0 else 4
            trades_in_tier_count = 0

    # Active tier on ladder matches current balance
    balance_active_id = f"{'dd' if tier_type == 'dd' else 'profit'}-step-{base_step_index}"
    balance_step_name = f"{step_prefix} {base_step_index + 1}"

    # Suggested step after trade count stepping
    suggested_step_name = f"{step_prefix} {stepped_index + 1}"

    return {
        "mode": mode,
        "stepName": balance_step_name,
        "activeId": balance_active_id,
        "type": tier_type,
        "baseStepIndex": base_step_index + 1,
        "suggested_risk": tier_risk_val,
        "suggestedStepName": suggested_step_name,
        "steppedIndex": stepped_index + 1,
        "max_trades": max_trades_in_tier,
        "trades_count": trades_in_tier_count,
        "is_fulfilled": trades_in_tier_count >= max_trades_in_tier,
        "total_open_trades": len(open_trades),
        "total_open_risk": round(total_open_risk, 2),
        "effective_balance": round(effective_bal, 2),
    }


def get_engine_data():
    """
    Returns config, current closed balance, open floating trades,
    active stepped tier risk, and closed trade history.
    Also synchronizes any open trades that have closed in MT5.
    """
    sync_closed_mt5_trades()

    cfg = get_risk_config()
    bal = get_balance()
    open_trades = get_open_trades()

    tier_state = calculate_tier_state(bal, open_trades, cfg)

    with _get_db() as conn:
        cur = conn.execute("SELECT * FROM risk_engine_history ORDER BY id DESC")
        history = [dict(r) for r in cur.fetchall()]

    return {
        "config": cfg,
        "balance": round(bal, 2),
        "tier": {
            "mode": tier_state["mode"],
            "stepName": tier_state["stepName"],
            "activeId": tier_state["activeId"],
            "type": tier_state["type"],
            "risk": tier_state["suggested_risk"],
            "steppedIndex": tier_state["steppedIndex"],
        },
        "tier_risk": tier_state["suggested_risk"],
        "tier_state": tier_state,
        "open_trades": open_trades,
        "open_trades_count": len(open_trades),
        "history": history,
    }


def open_engine_trade(custom_risk=None):
    """
    Manually opens a floating trade using the dynamically suggested tier risk (or custom).
    """
    cfg = get_risk_config()
    bal = get_balance()
    open_trades = get_open_trades()

    tier_state = calculate_tier_state(bal, open_trades, cfg)
    risk_amount = float(custom_risk) if (custom_risk and float(custom_risk) > 0) else float(tier_state["suggested_risk"])
    step_name = tier_state["suggestedStepName"]
    step_idx = tier_state["steppedIndex"]

    with _get_db() as conn:
        conn.execute(
            """
            INSERT INTO risk_engine_open_trades (mode, tier_step, risk)
            VALUES (?, ?, ?)
            """,
            (step_name, step_idx, risk_amount),
        )
        conn.commit()

    return get_engine_data()


def sync_closed_mt5_trades():
    """
    Checks if any open trades in risk_engine_open_trades with a ticket have been closed in MT5.
    If closed, calculates realized PnL, adds to engine balance, moves to risk_engine_history.
    """
    import MetaTrader5 as mt5
    open_trades = get_open_trades()
    ticket_trades = [t for t in open_trades if t.get("ticket")]
    if not ticket_trades:
        return

    if not mt5.initialize():
        return

    try:
        from datetime import datetime, timedelta
        # Check deals in the last 7 days
        deals = mt5.history_deals_get(datetime.now() - timedelta(days=7), datetime.now())
        if not deals:
            return

        # Map position_id to closing deals
        deals_by_pos = {}
        for d in deals:
            if d.position_id:
                deals_by_pos.setdefault(d.position_id, []).append(d)

        # Also get active open positions in MT5 to be certain
        raw_positions = mt5.positions_get()
        active_pos_ids = {p.ticket for p in raw_positions} if raw_positions else set()

        cfg = get_risk_config()
        bal = get_balance()

        for ot in ticket_trades:
            ticket = ot["ticket"]
            # If ticket is still in active MT5 positions, it's still open
            if ticket in active_pos_ids:
                continue

            # If it's not active, check if closed deals exist
            p_deals = deals_by_pos.get(ticket, [])
            out_deals = [d for d in p_deals if d.entry == 1]
            if out_deals or (p_deals and ticket not in active_pos_ids):
                # Calculate closed PnL in USD
                account = mt5.account_info()
                is_cent = account.currency == "USC" if account else False
                pnl_acc = sum(d.profit + d.swap + d.commission for d in p_deals)
                pnl_usd = round((pnl_acc / 100.0) if is_cent else pnl_acc, 2)
                is_win = 1 if pnl_usd >= 0 else 0

                bal += pnl_usd
                floor = float(cfg.get("terminalFloor", 1800))
                target = float(cfg.get("profitTarget", 2200))
                bal = max(floor, min(target, bal))
                save_balance(bal)

                with _get_db() as conn:
                    conn.execute("DELETE FROM risk_engine_open_trades WHERE id = ?", (ot["id"],))
                    conn.execute(
                        """
                        INSERT INTO risk_engine_history (ticket, symbol, mode, is_win, risk, pnl, new_balance)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (ticket, ot.get("symbol"), ot["mode"], is_win, ot["risk"], pnl_usd, bal),
                    )
                    conn.commit()
    except Exception:
        pass
    finally:
        mt5.shutdown()


def execute_engine_trade(is_win: bool, rr_ratio: float = None, exact_enabled: bool = False, exact_pnl: float = 0.0, open_trade_id: int = None):
    """
    Closes a trade (or creates a closed trade directly).
    If open_trade_id is supplied or if open trades exist, closes the oldest open trade and resolves its outcome.
    """
    cfg = get_risk_config()
    bal = get_balance()
    open_trades = get_open_trades()

    target_open_trade = None
    if open_trade_id:
        target_open_trade = next((t for t in open_trades if t["id"] == open_trade_id), None)
    elif open_trades:
        target_open_trade = open_trades[0]

    tier_state = calculate_tier_state(bal, open_trades, cfg)

    if target_open_trade:
        current_risk = float(target_open_trade["risk"])
        mode_name = target_open_trade["mode"]
    else:
        current_risk = float(tier_state["suggested_risk"])
        mode_name = tier_state["stepName"]

    if rr_ratio is None or rr_ratio <= 0:
        rr_ratio = float(cfg.get("rrRatio", 1.5))

    pnl = (
        (exact_pnl if is_win else -exact_pnl)
        if exact_enabled and exact_pnl > 0
        else (current_risk * rr_ratio if is_win else -current_risk)
    )

    bal += pnl
    floor = float(cfg.get("terminalFloor", 1800))
    target = float(cfg.get("profitTarget", 2200))
    bal = max(floor, bal)
    bal = min(target, bal)

    save_balance(bal)

    with _get_db() as conn:
        # If closing an open trade, remove it from open_trades table
        if target_open_trade:
            conn.execute("DELETE FROM risk_engine_open_trades WHERE id = ?", (target_open_trade["id"],))

        conn.execute(
            """
            INSERT INTO risk_engine_history (mode, is_win, risk, pnl, new_balance)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                mode_name,
                1 if is_win else 0,
                current_risk,
                pnl,
                bal,
            ),
        )
        conn.commit()

    return get_engine_data()


def delete_open_trade(trade_id: int):
    """
    Cancels an open floating trade without affecting balance.
    """
    with _get_db() as conn:
        conn.execute("DELETE FROM risk_engine_open_trades WHERE id = ?", (int(trade_id),))
        conn.commit()
    return get_engine_data()


def reset_engine_database():
    """
    Resets balance to startBalance and deletes all open and closed trade history.
    """
    cfg = get_risk_config()
    start_bal = float(cfg.get("startBalance", 2000))
    save_balance(start_bal)

    with _get_db() as conn:
        conn.execute("DELETE FROM risk_engine_history")
        conn.execute("DELETE FROM risk_engine_open_trades")
        conn.commit()

    return {
        "success": True,
        "balance": start_bal,
    }


def update_engine_config(new_config):
    """
    Updates config, resets balance to startBalance, and deletes history & open trades.
    """
    if not isinstance(new_config, dict):
        raise ValueError("Invalid configuration object")

    save_risk_config(new_config)
    start_bal = float(new_config.get("startBalance", 2000))
    save_balance(start_bal)

    with _get_db() as conn:
        conn.execute("DELETE FROM risk_engine_history")
        conn.execute("DELETE FROM risk_engine_open_trades")
        conn.commit()

    return {
        "success": True,
        "config": new_config,
        "balance": start_bal,
    }


def delete_engine_trade(trade_id: int):
    """
    Deletes a closed history trade and recalculates balance.
    """
    if not trade_id or int(trade_id) <= 0:
        raise ValueError("Invalid trade ID")

    cfg = get_risk_config()

    with _get_db() as conn:
        conn.execute("DELETE FROM risk_engine_history WHERE id = ?", (int(trade_id),))

        cur = conn.execute("SELECT * FROM risk_engine_history ORDER BY id ASC")
        remaining_trades = [dict(r) for r in cur.fetchall()]

        current_bal = float(cfg.get("startBalance", 2000))
        floor = float(cfg.get("terminalFloor", 1800))
        target = float(cfg.get("profitTarget", 2200))

        for t in remaining_trades:
            current_bal += float(t["pnl"])
            current_bal = max(floor, current_bal)
            current_bal = min(target, current_bal)

            conn.execute(
                "UPDATE risk_engine_history SET new_balance = ? WHERE id = ?",
                (current_bal, t["id"]),
            )

        conn.commit()

    save_balance(current_bal)
    return get_engine_data()
