import importlib
import pkgutil
import api


def register_all_routes():
    routes = {}

    for module in pkgutil.iter_modules(api.__path__):
        if module.name.endswith("_routes"):
            route_module = importlib.import_module(
                f"api.{module.name}"
            )
            route_module.register_routes(routes)

    return routes