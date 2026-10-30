from controllers.news_controller import get_news_controller


def register_routes(router):
    router["/api/news"] = get_news_controller
