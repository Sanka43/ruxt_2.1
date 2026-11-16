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
