from controllers.account_controller import account_controller


def register_routes(router):
    router["/api/account"] = account_controller