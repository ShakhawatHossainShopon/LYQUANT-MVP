from controllers.risk_controller import (
    risk_overview_controller,
    update_risk_config_controller,
    reset_risk_framework_controller,
    execute_engine_trade_controller,
    open_engine_trade_controller,
    delete_open_trade_controller,
    delete_engine_trade_controller,
)


def register_routes(router):
    router["/api/risk/overview"] = risk_overview_controller
    router["/api/risk/config"] = update_risk_config_controller
    router["/api/risk/reset"] = reset_risk_framework_controller
    router["/api/risk/trade"] = execute_engine_trade_controller
    router["/api/risk/open-trade"] = open_engine_trade_controller
    router["/api/risk/cancel-open"] = delete_open_trade_controller
    router["/api/risk/delete-trade"] = delete_engine_trade_controller
