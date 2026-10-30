from controllers.currency_controller import currency_controller


def register_routes(router):
    router["/api/account/currency"] = currency_controller