from services.test_service import test_services


def testController():
    try:
        result = test_services("EURUSDc", 0.01)

        return {
            "success": True,
            "data": result
        }, 200

    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }, 500