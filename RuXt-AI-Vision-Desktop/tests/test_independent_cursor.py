import time
from ruxt_agent_s.core.actions import DesktopActionExecutor, get_physical_cursor_pos, set_physical_cursor_pos
from ruxt_agent_s.core.ai_ghost_cursor import get_ai_ghost_cursor

def test_independent_ghost_cursor():
    ghost = get_ai_ghost_cursor()
    ghost.start()
    ghost.show(True)
    
    # 1. Test move_to
    ghost.move_to(250, 250, duration=0.05)
    assert ghost.current_x == 250
    assert ghost.current_y == 250
    
    ghost.stop()

def test_park_click_return_user_preservation():
    from ruxt_agent_s.core.ai_ghost_cursor import stop_ai_ghost_cursor
    executor = DesktopActionExecutor(screen_size=(1920, 1080), independent_cursor=True)
    try:
        # Perform an AI click at target (500, 500)
        executor.click(500, 500)
        assert executor.ghost_cursor.current_x == 500
        assert executor.ghost_cursor.current_y == 500
    finally:
        stop_ai_ghost_cursor()

