from services.account_service import get_account_details


def account_controller():
    return {
        "success": True,
        "data": get_account_details()
    }