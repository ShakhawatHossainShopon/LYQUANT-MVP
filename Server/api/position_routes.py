from controllers.position_controller import position_controller


def register_routes(router):
    router["/api/positions"] = position_controller
