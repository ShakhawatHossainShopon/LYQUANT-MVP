from controllers.summary_controller import summary_controller


def register_routes(router):
    router["/api/account/summary"] = summary_controller