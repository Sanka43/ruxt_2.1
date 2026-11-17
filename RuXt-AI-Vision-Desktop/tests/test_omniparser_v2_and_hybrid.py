import pytest
from PIL import Image
from ruxt_agent_s.config import load_config
from ruxt_agent_s.core.grounding import OmniParserV2Grounder, SetOfMarksEngine, UIBox, VisualGrounder
from ruxt_agent_s.core.actions import DesktopActionExecutor
from ruxt_agent_s.agent import RuXtVisionAgent
from ruxt_agent_s.llm.client import MultiModalLLMClient

def test_som_engine_draw():
    som = SetOfMarksEngine()
    test_img = Image.new("RGB", (640, 480), color=(240, 240, 240))
    boxes = [
        UIBox(box_id=0, bbox=(50, 50, 150, 90), center=(100, 70), label="Search", element_type="button"),
        UIBox(box_id=1, bbox=(200, 100, 400, 140), center=(300, 120), label="URL Bar", element_type="input"),
        UIBox(box_id=2, bbox=(500, 20, 540, 60), center=(520, 40), label="Close", element_type="icon"),
    ]
    tagged = som.draw_som_overlay(test_img, boxes)
    assert tagged.size == (640, 480)
    assert tagged.mode == "RGB"

def test_omniparser_hybrid_parsing():
    grounder = OmniParserV2Grounder(screen_width=1280, screen_height=720, mode="hybrid")
    test_img = Image.new("RGB", (1280, 720), color=(255, 255, 255))
    tagged_img, box_map, summary = grounder.parse_screen(test_img, "Test Window")

    assert tagged_img is not None
    assert isinstance(box_map, dict)
    assert isinstance(summary, str)
    
    # If any boxes exist, test coordinate resolution
    if box_map:
        first_id = list(box_map.keys())[0]
        center = grounder.resolve_box(first_id)
        assert center is not None
        assert len(center) == 2

def test_visual_grounder_box_and_uitars_parsing():
    grounder = VisualGrounder(screen_width=1000, screen_height=1000)
    
    # UI-TARS start_box pattern
    coords = grounder.extract_coordinates("Action: click(start_box='(500, 300)')")
    assert coords == (500, 300)

    # UI-TARS point pattern
    coords_pt = grounder.extract_coordinates("Action: click(point='[250, 750]')")
    assert coords_pt == (250, 750)

    # Standard pattern
    coords_std = grounder.extract_coordinates("agent.click(x=100, y=200)")
    assert coords_std == (100, 200)

def test_agent_som_and_uitars_response_parsing():
    config = load_config()
    agent = RuXtVisionAgent(config=config)

    # 1. OmniParser Set-of-Marks box_id
    res1 = agent._parse_response("""
    Reflection: Search bar is tagged as Box 3.
    Plan: Click search bar to focus.
    Action: agent.click(box_id=3, description="Search Input")
    """)
    assert "agent.click(box_id=3" in res1["action"]

    # 2. UI-TARS start_box syntax (normalizes 0-1000 to screen pixel space)
    res2 = agent._parse_response("""
    Thought: Need to click button.
    Action: click(start_box='(600, 400)')
    """)
    assert "agent.click(x=" in res2["action"] and "y=" in res2["action"]

    # 3. PyWinAuto control syntax
    res3 = agent._parse_response("""
    Reflection: File menu is visible.
    Plan: Click File menu.
    Action: agent.click_control(query="File")
    """)
    assert res3["action"] == 'agent.click_control(query="File")'

    # 4. Window management syntax
    res4 = agent._parse_response("""
    Reflection: Need calculator.
    Plan: Focus calculator window.
    Action: agent.focus_window(title="Calculator")
    """)
    assert res4["action"] == 'agent.focus_window(title="Calculator")'

def test_hybrid_actions_executor():
    executor = DesktopActionExecutor(
        screen_size=(1920, 1080),
        independent_cursor=True,
        enable_pywinauto=True
    )
    assert executor.enable_pywinauto is True
    # Test safe non-crashing behavior for non-existent window / control
    res_ctrl = executor.click_control("NonExistentRuXtDummyControl123")
    assert res_ctrl is False
    res_win = executor.focus_window("NonExistentRuXtDummyWindow123")
    assert res_win is False
