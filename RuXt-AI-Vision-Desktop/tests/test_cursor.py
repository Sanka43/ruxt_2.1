import platform
import pytest
from ruxt_agent_s.core.cursor import set_ai_cursor, restore_cursor

def test_ai_cursor_lifecycle():
    if platform.system() != "Windows":
        pytest.skip("Windows cursor test only")

    # 1. Enable Neon Blue AI cursor
    res_set = set_ai_cursor(True)
    assert res_set is True, "Failed to switch cursor to Neon Blue AI Pointer"

    # 2. Restore default cursor
    res_restore = set_ai_cursor(False)
    assert res_restore is True, "Failed to restore standard system cursor"
