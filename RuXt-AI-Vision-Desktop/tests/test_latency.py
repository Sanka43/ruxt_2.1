import time
import pytest
from ruxt_agent_s.llm.client import MultiModalLLMClient
from ruxt_agent_s.core.observation import ScreenObserver

def test_observation_capture_speed():
    observer = ScreenObserver(max_width=1024, max_height=768)
    t0 = time.time()
    obs = observer.capture(resize_for_model=True)
    t_delta = time.time() - t0
    print(f"\nScreenshot capture & encode time: {t_delta * 1000:.1f}ms (size: {len(obs.image_base64) / 1024:.1f}KB)")
    assert t_delta < 0.25, f"Capture too slow: {t_delta}s"
    assert obs.image_base64 is not None

def test_persistent_bridge_speed():
    client = MultiModalLLMClient(provider="antigravity", model="flash")
    observer = ScreenObserver(max_width=1024, max_height=768)
    obs = observer.capture(resize_for_model=True)

    # First call (cold warmup)
    t0 = time.time()
    res1 = client.generate(
        system_prompt="You are a speed test bot. Reply with 'READY'.",
        user_prompt="Say READY.",
        image_base64=obs.image_base64
    )
    t1 = time.time() - t0
    print(f"\nStep 1 (Warmup) duration: {t1:.2f}s | Result: {res1.strip()[:40]}")
    assert len(res1) > 0

    # Second call (warm persistent pipeline)
    t0 = time.time()
    res2 = client.generate(
        system_prompt="You are a speed test bot. Reply with 'READY'.",
        user_prompt="Say READY.",
        image_base64=obs.image_base64
    )
    t2 = time.time() - t0
    print(f"\nStep 2 (Persistent Warm) duration: {t2:.2f}s | Result: {res2.strip()[:40]}")
    assert len(res2) > 0
    assert t2 < 15.0, f"Persistent call too slow: {t2}s"
