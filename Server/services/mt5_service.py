
import MetaTrader5 as mt5


def get_account():
    # Connect to the local MT5 terminal
    if not mt5.initialize():
        error = mt5.last_error()
        raise RuntimeError(
            f"MT5 initialization failed: {error}. "
            "Open the MT5 terminal and check your connection."
        )

    try:
        account = mt5.account_info()

        if account is None:
            raise RuntimeError(
                f"Account details unavailable: {mt5.last_error()}"
            )

        return account._asdict()

    finally:
        mt5.shutdown()
