import pytest
from ruxt_agent_s.config import load_config
from ruxt_agent_s.core.grounding import VisualGrounder
from ruxt_agent_s.core.observation import ScreenObserver
from ruxt_agent_s.agent import RuXtVisionAgent

def test_config_loading():
    config = load_config()
    assert config.provider in ["antigravity", "openai", "anthropic", "gemini", "ollama", "openrouter"]
    assert config.grounding.coordinate_scale == 1000

def test_visual_grounding_coordinates():
    grounder = VisualGrounder(screen_width=1920, screen_height=1080, coordinate_scale=1000)
    
    # Test normalized 0-1000
    px, py = grounder.normalize_to_pixels(500, 500)
    assert px == 960
    assert py == 540

    # Test top-left and bottom-right
    tl_x, tl_y = grounder.normalize_to_pixels(0, 0)
    assert tl_x == 0 and tl_y == 0

    br_x, br_y = grounder.normalize_to_pixels(1000, 1000)
    assert br_x == 1919 and br_y == 1079

    # Test extraction from text
    extracted = grounder.extract_coordinates("Please click at [250, 750] right now")
    assert extracted == (480, 810)

def test_screen_observation():
    observer = ScreenObserver(max_width=800, max_height=600)
    w, h = observer.get_screen_resolution()
    assert w > 0 and h > 0
    
    obs = observer.capture(resize_for_model=True)
    assert obs.image is not None
    assert len(obs.image_base64) > 100
    assert obs.width == w
    assert obs.height == h

def test_response_parser():
    config = load_config()
    agent = RuXtVisionAgent(config=config)
    
    sample_llm_output = """
Reflection: The Chrome window is open and the address bar is visible at the top.
Plan: Click the search bar and prepare to type the search query.
Action: agent.click(x=450, y=82, description="Chrome address bar")
    """
    
    parsed = agent._parse_response(sample_llm_output)
    assert "Chrome window is open" in parsed["reflection"]
    assert "Click the search bar" in parsed["plan"]
    assert parsed["action"] == 'agent.click(x=450, y=82, description="Chrome address bar")'
    assert len(parsed["actions"]) == 1

def test_multi_action_chaining_parser():
    config = load_config()
    agent = RuXtVisionAgent(config=config)
    
    multi_action_output = """
Reflection: The Notepad window is focused and empty.
Plan: Click canvas, type text, and press enter in one continuous sequence.
Action:
agent.click(x=300, y=400)
agent.type(text="RuXt Fast Mode")
agent.press_key(key="enter")
    """
    
    parsed = agent._parse_response(multi_action_output)
    assert len(parsed["actions"]) == 3
    assert parsed["actions"][0] == "agent.click(x=300, y=400)"
    assert parsed["actions"][1] == 'agent.type(text="RuXt Fast Mode")'
    assert parsed["actions"][2] == 'agent.press_key(key="enter")'
    assert parsed["action"] == parsed["actions"][0]

def test_semicolon_and_unprefixed_action_chaining():
    config = load_config()
    agent = RuXtVisionAgent(config=config)
    
    output = """
Action:
click(x=100, y=200); type(text="hello"); press_key(key="enter")
    """
    parsed = agent._parse_response(output)
    assert len(parsed["actions"]) == 3
    assert parsed["actions"][0] == "agent.click(x=100, y=200)"
    assert parsed["actions"][1] == 'agent.type(text="hello")'
    assert parsed["actions"][2] == 'agent.press_key(key="enter")'

def test_user_takeover_action_parsing():
    config = load_config()
    agent = RuXtVisionAgent(config=config)
    
    output = """
Reflection: The login screen has appeared with a password field and 2FA prompt.
Plan: Ask the user to enter their password securely.
Action: agent.request_user_intervention(message="Please enter your master password and complete 2FA login.")
    """
    parsed = agent._parse_response(output)
    assert len(parsed["actions"]) == 1
    assert parsed["actions"][0] == 'agent.request_user_intervention(message="Please enter your master password and complete 2FA login.")'

def test_signal_paths_and_abort_check():
    config = load_config()
    agent = RuXtVisionAgent(config=config)
    
    paths = agent._get_signal_paths("resume.signal")
    assert len(paths) >= 3
    assert any("data" in str(p) or "desktop_runs" in str(p) for p in paths)
    
    # Test _is_aborted initially false
    assert agent._is_aborted() is False

def test_letter_by_letter_typing_configuration():
    config = load_config()
    assert config.execution.type_via_clipboard is False
    assert config.execution.typing_interval == 0.025
    
    agent = RuXtVisionAgent(config=config)
    assert agent.actions.type_via_clipboard is False
    assert agent.actions.typing_interval == 0.025

def test_screen_observer_foreground_hwnd():
    config = load_config()
    agent = RuXtVisionAgent(config=config)
    hwnd = agent.observer.get_foreground_hwnd()
    assert isinstance(hwnd, int)
    assert hwnd >= 0

def test_screen_observer_visible_windows():
    config = load_config()
    agent = RuXtVisionAgent(config=config)
    windows = agent.observer.get_visible_windows()
    assert isinstance(windows, list)
    if windows:
        w = windows[0]
        assert "title" in w
        assert "hwnd" in w
        assert "is_active" in w

def test_prompt_includes_open_windows():
    from ruxt_agent_s.llm.prompts import format_worker_user_prompt
    mock_windows = [
        {"title": "New Tab - Google Chrome", "is_active": True},
        {"title": "Visual Studio Code", "is_active": False}
    ]
    prompt = format_worker_user_prompt(
        task="search for weather",
        step_num=1,
        max_steps=10,
        active_window="New Tab - Google Chrome",
        history=[],
        open_windows=mock_windows
    )
    assert "Currently Open Application Windows:" in prompt
    assert "New Tab - Google Chrome" in prompt
    assert "[ACTIVE FOREGROUND]" in prompt
    assert "Visual Studio Code" in prompt
    assert "[BACKGROUND]" in prompt







