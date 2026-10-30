from controllers.trade_controller import open_trade_controller, calc_trade_controller


def register_routes(router):
    router["/api/trade/open"] = open_trade_controller
    router["/api/trade/calc"] = calc_trade_controller
