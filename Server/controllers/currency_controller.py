from services.currency_service import get_account_currency


def currency_controller():
    return {
        "success": True,
        "data": get_account_currency()
    }