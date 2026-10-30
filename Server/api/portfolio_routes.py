from controllers.portfolio_controller import get_portfolio_controller


def register_routes(router):
    router["/api/portfolio"] = get_portfolio_controller
