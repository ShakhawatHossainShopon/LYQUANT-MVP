from services.mt5_service import get_account


def get_account_currency():
    account = get_account()

    return {
        "currency": account["currency"]
    }