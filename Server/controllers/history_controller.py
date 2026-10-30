from services.history_service import get_trading_history
from services.close_service import close_position, close_all_positions


def get_history_controller(request=None):
    try:
        data = get_trading_history(days=90)
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def close_position_controller(body=None):
    if not body or "ticket" not in body:
        return {
            "success": False,
            "error": "Missing required field 'ticket'"
        }

    try:
        ticket = int(body["ticket"])
        result = close_position(ticket)
        return {
            "success": True,
            "data": result,
            "message": f"Position #{ticket} successfully closed"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def close_all_positions_controller(body=None):
    try:
        result = close_all_positions()
        return {
            "success": True,
            "data": result,
            "message": "All positions processed for closure"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
