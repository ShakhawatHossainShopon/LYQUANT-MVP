from services.news_service import get_news_and_calendar


def get_news_controller(request=None):
    try:
        data = get_news_and_calendar()
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
