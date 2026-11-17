import pytest
from unittest.mock import MagicMock, patch
from ruxt_agent_s.core.actions import DesktopActionExecutor
from ruxt_agent_s.config import AppConfig, ExecutionConfig
from ruxt_agent_s.agent import RuXtVisionAgent

def test_direct_cursor_executor_init():
    # Direct cursor mode by default: no ghost overlay created or used
    executor = DesktopActionExecutor(screen_size=(1920, 1080), cursor_mode="direct", independent_cursor=False)
    assert executor.cursor_mode == "direct"
    assert executor.independent_cursor is False
    assert executor.ghost_cursor is None

def test_ghost_cursor_executor_init():
    # Explicit ghost cursor mode
    executor = DesktopActionExecutor(screen_size=(1920, 1080), cursor_mode="ghost", independent_cursor=True)
    assert executor.cursor_mode == "ghost"
    assert executor.independent_cursor is True
    assert executor.ghost_cursor is not None

def test_draw_shape_freehand_and_drag_box():
    executor = DesktopActionExecutor(screen_size=(1920, 1080), cursor_mode="direct", independent_cursor=False)
    
    with patch.object(executor, "draw_stroke") as mock_stroke, \
         patch.object(executor, "drag_and_drop") as mock_drag:
        
        # 1. Circle freehand
        executor.draw_shape(shape="circle", x=500, y=500, width=200, height=200, mode="freehand")
        assert mock_stroke.called
        circle_pts = mock_stroke.call_args[0][0]
        assert len(circle_pts) > 30

        # 2. Circle drag_box (Paint Shape Tool)
        executor.draw_shape(shape="circle", x=500, y=500, width=200, height=200, mode="drag_box")
        assert mock_drag.called
        mock_drag.assert_called_with(400, 400, 600, 600, duration=0.6)

        # 3. Rectangle freehand
        mock_stroke.reset_mock()
        executor.draw_shape(shape="rectangle", x=400, y=300, width=100, height=80, mode="freehand")
        assert mock_stroke.called
        rect_pts = mock_stroke.call_args[0][0]
        assert len(rect_pts) == 5

def test_draw_stroke_win32_hardware_events():
    executor = DesktopActionExecutor(screen_size=(1920, 1080), cursor_mode="direct", independent_cursor=False)
    
    with patch("ruxt_agent_s.core.actions.win32_hardware_mouse_down") as mock_down, \
         patch("ruxt_agent_s.core.actions.win32_hardware_mouse_move") as mock_move, \
         patch("ruxt_agent_s.core.actions.win32_hardware_mouse_up") as mock_up:
        
        pts = [(100, 100), (150, 120), (200, 150)]
        executor.draw_stroke(pts, duration=0.05)
        
        # Verify mouse down was called
        mock_down.assert_called_once_with("left")
        # Verify dense move events were pumped
        assert mock_move.call_count >= 15
        # Verify mouse up was called
        mock_up.assert_called_once_with("left")

def test_drag_and_drop_win32_hardware_events():
    executor = DesktopActionExecutor(screen_size=(1920, 1080), cursor_mode="direct", independent_cursor=False)
    
    with patch("ruxt_agent_s.core.actions.win32_hardware_mouse_down") as mock_down, \
         patch("ruxt_agent_s.core.actions.win32_hardware_mouse_move") as mock_move, \
         patch("ruxt_agent_s.core.actions.win32_hardware_mouse_up") as mock_up:
        
        executor.drag_and_drop(from_x=250, from_y=350, to_x=600, to_y=700, duration=0.05)
        
        # Verify mouse down was called
        mock_down.assert_called_once_with("left")
        # Verify dense sub-step moves were called
        assert mock_move.call_count >= 10
        # Verify mouse up was called
        mock_up.assert_called_once_with("left")

def test_agent_action_aliases_and_drawing():
    config = AppConfig()
    config.execution.cursor_mode = "direct"
    config.execution.independent_cursor = False
    
    agent = RuXtVisionAgent(config=config)
    
    with patch.object(agent.actions, "draw_shape") as mock_shape, \
         patch.object(agent.actions, "draw_stroke") as mock_stroke, \
         patch.object(agent.actions, "drag_and_drop") as mock_drag, \
         patch.object(agent.actions, "right_click") as mock_right, \
         patch.object(agent.actions, "double_click") as mock_dbl:
        
        # 1. Test agent.draw_shape parsing with mode
        res = agent._execute_parsed_action('agent.draw_shape(shape="circle", x=500, y=500, width=200, height=200, mode="freehand")')
        assert "Drawn circle" in res
        assert mock_shape.called
        
        # 2. Test click_and_drag alias
        res = agent._execute_parsed_action('agent.click_and_drag(from_x=100, from_y=100, to_x=200, to_y=200)')
        assert "Dragged from" in res
        assert mock_drag.called
        
        # 3. Test write_click alias
        res = agent._execute_parsed_action('agent.write_click(x=300, y=300)')
        assert "Right-clicked" in res
        assert mock_right.called

        # 4. Test dblclick alias
        res = agent._execute_parsed_action('agent.dblclick(x=400, y=400)')
        assert "Double-clicked" in res
        assert mock_dbl.called
