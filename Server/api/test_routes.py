from controllers.test_controller import testController


def register_routes(router):
    router["/api/test"] = testController