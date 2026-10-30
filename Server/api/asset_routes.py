from controllers.asset_controller import (
    all_assets_controller,
    tracked_assets_controller,
    toggle_asset_controller,
)


def register_routes(router):
    router["/api/assets"] = all_assets_controller
    router["/api/assets/tracked"] = tracked_assets_controller
    router["/api/assets/toggle"] = toggle_asset_controller
