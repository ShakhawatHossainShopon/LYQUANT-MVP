from services.mt5_service import get_account


def get_account_summary():
    account = get_account()

    return {
        "balance": account["balance"],
        "equity": account["equity"],
        "profit": account["profit"],
        "margin": account["margin"],
        "free_margin": account["margin_free"],
        "currency": account["currency"]
    }