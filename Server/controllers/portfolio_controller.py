from services.portfolio_service import get_portfolio_analytics


def get_portfolio_controller(request=None):
    try:
        data = get_portfolio_analytics()
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
