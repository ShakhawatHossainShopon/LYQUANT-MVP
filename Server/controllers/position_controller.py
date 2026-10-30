from services.position_service import get_open_positions


def position_controller():
    return {
        "success": True,
        "data": get_open_positions()
    }
