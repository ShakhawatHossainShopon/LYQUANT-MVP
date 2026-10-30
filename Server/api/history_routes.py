from controllers.history_controller import (
    get_history_controller,
    close_position_controller,
    close_all_positions_controller,
)


def register_routes(router):
    router["/api/history"] = get_history_controller
    router["/api/positions/close"] = close_position_controller
    router["/api/positions/close-all"] = close_all_positions_controller
