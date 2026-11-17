import time
import pytest
from ruxt_agent_s.config import load_config
from ruxt_agent_s.llm.client import MultiModalLLMClient
from ruxt_agent_s.core.observation import ScreenObserver

def test_observation_capture_speed():
    observer = ScreenObserver(max_width=1280, max_height=720)
    t0 = time.time()
    obs = observer.capture(resize_for_model=True)
    t_delta = time.time() - t0
    print(f"\nScreenshot capture & encode time: {t_delta * 1000:.1f}ms (size: {len(obs.image_base64) / 1024:.1f}KB)")
    assert t_delta < 0.25, f"Capture too slow: {t_delta}s"
    assert obs.image_base64 is not None

def test_fastest_provider_speed():
    config = load_config()
    print(f"\n[Speed Priority] Active Provider: {config.provider} | Model: {config.model}")
    assert config.provider in ["gemini", "anthropic", "openai", "antigravity"]

    client = MultiModalLLMClient(
        provider=config.provider,
        model=config.model,
        api_key=config.api_key,
        base_url=config.base_url
    )
    observer = ScreenObserver(max_width=config.grounding.screenshot_max_width, max_height=config.grounding.screenshot_max_height)
    obs = observer.capture(resize_for_model=True)

    t0 = time.time()
    res = client.generate(
        system_prompt="You are a speed test bot. Reply with 'READY'.",
        user_prompt="Say READY.",
        image_base64=obs.image_base64
    )
    t_elapsed = time.time() - t0
    print(f"Step duration ({config.provider}): {t_elapsed:.2f}s | Result: {res.strip()[:40]}")
    assert len(res) > 0
    assert t_elapsed < 25.0, f"Call too slow: {t_elapsed}s"
