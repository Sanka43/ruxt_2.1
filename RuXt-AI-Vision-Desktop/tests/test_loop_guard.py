import importlib.util
from pathlib import Path

import pytest

_path = Path(__file__).resolve().parent.parent / "ruxt_agent_s" / "core" / "loop_guard.py"
_spec = importlib.util.spec_from_file_location("ruxt_loop_guard", _path)
loop_guard = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(loop_guard)

LoopGuard, OK, WARN, STOP = loop_guard.LoopGuard, loop_guard.OK, loop_guard.WARN, loop_guard.STOP

CLICK = 'agent.click(x=500, y=300, description="Next")'


def test_identical_actions_warn_then_stop():
    guard = LoopGuard(warn_after=3, stop_after=5)
    states = [guard.record(CLICK, "Clicked") for _ in range(5)]
    assert states == [OK, OK, WARN, OK, STOP]


def test_a_different_action_resets_the_count():
    guard = LoopGuard(warn_after=3, stop_after=5)
    for _ in range(2):
        guard.record(CLICK, "Clicked")
    assert guard.record('agent.click(x=1, y=1, description="Other")', "Clicked") == OK
    assert guard.record(CLICK, "Clicked") == OK  # count restarted


def test_same_action_with_a_different_result_is_not_a_loop():
    guard = LoopGuard(warn_after=3, stop_after=5)
    states = [guard.record(CLICK, f"Clicked item {i}") for i in range(10)]
    assert set(states) == {OK}


@pytest.mark.parametrize("action", ["agent.wait(1)", "agent.scroll(-300)", 'agent.press_key("down")'])
def test_naturally_repetitive_actions_are_ignored(action):
    guard = LoopGuard(warn_after=2, stop_after=3)
    assert {guard.record(action, "ok") for _ in range(10)} == {OK}


def test_whitespace_differences_do_not_hide_a_loop():
    guard = LoopGuard(warn_after=2, stop_after=3)
    guard.record("agent.click(x=1,  y=2)", "r")
    assert guard.record("agent.click(x=1, y=2)", "r") == WARN


def test_reset_clears_history():
    guard = LoopGuard(warn_after=2, stop_after=3)
    guard.record(CLICK, "r")
    guard.reset()
    assert guard.record(CLICK, "r") == OK


def test_invalid_thresholds_are_rejected():
    with pytest.raises(ValueError):
        LoopGuard(warn_after=5, stop_after=5)
