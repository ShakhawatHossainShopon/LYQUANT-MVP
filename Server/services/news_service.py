import MetaTrader5 as mt5
import urllib.request
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta


def _fetch_economic_calendar():
    url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=6) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Error fetching economic calendar: {e}")
        return []


def _fetch_market_news():
    urls = [
        "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines"
    ]
    news_items = []
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=5) as response:
                root = ET.fromstring(response.read())
                for item in root.findall(".//item"):
                    title = item.find("title").text if item.find("title") is not None else ""
                    desc = item.find("description").text if item.find("description") is not None else ""
                    pub = item.find("pubDate").text if item.find("pubDate") is not None else ""
                    link = item.find("link").text if item.find("link") is not None else ""
                    if title:
                        news_items.append({
                            "title": title.strip(),
                            "description": desc.strip() if desc else "",
                            "pub_date": pub.strip() if pub else "",
                            "link": link.strip() if link else "",
                            "source": "MarketWatch"
                        })
        except Exception as e:
            print(f"Error fetching RSS news from {url}: {e}")

    # Remove duplicates by title
    seen = set()
    unique_news = []
    for n in news_items:
        if n["title"] not in seen:
            seen.add(n["title"])
            unique_news.append(n)

    return unique_news[:25]


def get_news_and_calendar():
    """
    Fetches real-time economic calendar and financial news, cross-referenced with
    active open positions in MT5 to determine 'When Not to Trade' and risk zones.
    """
    raw_events = _fetch_economic_calendar()
    market_news = _fetch_market_news()

    now_utc = datetime.now(timezone.utc)

    # 1. Fetch active open positions from MT5
    active_symbols = set()
    open_positions_list = []
    if mt5.initialize():
        try:
            positions = mt5.positions_get() or ()
            for p in positions:
                active_symbols.add(p.symbol)
                open_positions_list.append({
                    "ticket": p.ticket,
                    "symbol": p.symbol,
                    "type": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
                    "volume": p.volume,
                    "profit": p.profit
                })
        finally:
            mt5.shutdown()

    # 2. Process Economic Events
    parsed_events = []
    imminent_high_impact = []
    next_high_impact = None
    min_future_diff = float("inf")

    for ev in raw_events:
        title = ev.get("title", "")
        country = ev.get("country", "")
        impact = ev.get("impact", "Low")
        date_str = ev.get("date", "")
        forecast = ev.get("forecast", "")
        previous = ev.get("previous", "")

        try:
            # Parse ISO date with timezone
            ev_dt = datetime.fromisoformat(date_str)
            diff_minutes = (ev_dt - now_utc).total_seconds() / 60.0
        except Exception:
            diff_minutes = None

        status = "UPCOMING"
        countdown_str = ""
        if diff_minutes is not None:
            if diff_minutes < -60:
                status = "PASSED"
                countdown_str = f"{abs(int(diff_minutes // 60))}h ago"
            elif diff_minutes < 0:
                status = "PASSED"
                countdown_str = f"{abs(int(diff_minutes))}m ago"
            elif diff_minutes <= 60:
                status = "IMMINENT"
                countdown_str = f"In {int(diff_minutes)} mins"
            else:
                hrs = int(diff_minutes // 60)
                rem_m = int(diff_minutes % 60)
                countdown_str = f"In {hrs}h {rem_m}m"

            # Check if this is an imminent High Impact event (-15m to +30m)
            if impact == "High":
                if -15 <= diff_minutes <= 30:
                    imminent_high_impact.append({
                        "title": title,
                        "country": country,
                        "minutes_away": int(diff_minutes),
                        "countdown_str": countdown_str
                    })
                if 0 <= diff_minutes < min_future_diff:
                    min_future_diff = diff_minutes
                    next_high_impact = {
                        "title": title,
                        "country": country,
                        "date": date_str,
                        "countdown_str": countdown_str,
                        "minutes_away": int(diff_minutes)
                    }

        # Determine which MT5 assets are affected by this currency
        affected_pairs = []
        c = country.upper()
        for sym in ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "US30", "XAUUSD"]:
            if c in sym or (c == "USD" and sym in ["US30", "XAUUSD"]):
                affected_pairs.append(sym)

        parsed_events.append({
            "title": title,
            "country": country,
            "impact": impact,
            "date": date_str,
            "forecast": forecast,
            "previous": previous,
            "status": status,
            "countdown": countdown_str,
            "minutes_diff": int(diff_minutes) if diff_minutes is not None else None,
            "affected_pairs": affected_pairs[:4]
        })

    # 3. Determine "When Not to Trade" status (No-Trade Zone)
    is_no_trade_active = len(imminent_high_impact) > 0

    no_trade_cockpit = {
        "is_active": is_no_trade_active,
        "status": "NO_TRADE_ZONE" if is_no_trade_active else "CLEAR_TO_TRADE",
        "title": "NO-TRADE WINDOW ACTIVE" if is_no_trade_active else "NORMAL MARKET CONDITIONS — TRADING CLEAR",
        "imminent_events": imminent_high_impact,
        "next_high_impact": next_high_impact,
        "active_rules": [
            "⛔ RULE 1: Never open market orders within 15 minutes before or after High-Impact (Red) releases.",
            "⛔ RULE 2: Watch for extreme spread spikes up to 10x–20x normal width during news drops.",
            "⛔ RULE 3: Never hold unhedged tight-stop positions into Tier-1 US data (NFP, CPI, FOMC, Fed Rate).",
            "✅ RULE 4: Wait at least 15 minutes post-release for price action to confirm true institutional direction."
        ],
        "recommendation": (
            f"HIGH VOLATILITY ALERT: {imminent_high_impact[0]['title']} ({imminent_high_impact[0]['country']}) is dropping {imminent_high_impact[0]['countdown_str']}. DO NOT OPEN NEW POSITIONS. Protect open trades with breakeven stops."
            if is_no_trade_active
            else f"No high-impact events in the immediate 30-minute window. Next major release: {next_high_impact['title'] if next_high_impact else 'None'} ({next_high_impact['countdown_str'] if next_high_impact else 'Clear'})."
        )
    }

    # 4. Cross reference open positions with upcoming news
    vulnerable_positions = []
    for pos in open_positions_list:
        sym = pos["symbol"].upper().replace("C", "")
        # Find any upcoming high-impact news in next 12 hours affecting this pair
        matching_events = [
            e for e in parsed_events
            if e["impact"] == "High"
            and e.get("minutes_diff") is not None
            and 0 <= e["minutes_diff"] <= 720
            and (e["country"] in sym or (e["country"] == "USD" and sym in ["US30", "XAUUSD"]))
        ]
        if matching_events:
            vulnerable_positions.append({
                **pos,
                "threatening_events": matching_events[:3]
            })

    return {
        "no_trade_cockpit": no_trade_cockpit,
        "vulnerable_positions": vulnerable_positions,
        "economic_events": parsed_events,
        "market_news": market_news,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
