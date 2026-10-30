from services.summary_service import get_account_summary


def summary_controller():
    return {
        "success": True,
        "data": get_account_summary()
    }