"""Tests for how the safety gate is wired into RuXtVisionAgent (no screen or LLM needed)."""
import threading
import time
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from ruxt_agent_s import agent as agent_module
from ruxt_agent_s.agent import RuXtVisionAgent


@pytest.fixture
def stub_agent(tmp_path, monkeypatch):
    """An agent object that skips __init__ (which opens the screen and the LLM client)."""
    monkeypatch.setenv("RUXT_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("RUXT_SAFETY_MODE", raising=False)
    monkeypatch.setattr(agent_module, "set_ai_cursor", lambda *a, **k: True)  # don't touch the real cursor
    agent = RuXtVisionAgent.__new__(RuXtVisionAgent)
    agent.history = []
    agent.on_step_callback = None
    agent.config = SimpleNamespace(agent=SimpleNamespace(data_dir=str(tmp_path)))
    agent.actions = MagicMock()
    return agent


def test_destructive_typing_is_blocked_and_never_executed(stub_agent):
    result = stub_agent._execute_parsed_action('agent.type(text="format c:")')
    assert result.startswith("BLOCKED_BY_SAFETY")
    stub_agent.actions.type_text.assert_not_called()


def test_denied_action_is_not_executed(stub_agent, monkeypatch):
    monkeypatch.setattr(stub_agent, "_request_approval", lambda *a, **k: "denied")
    result = stub_agent._execute_parsed_action('agent.hotkey(keys=["shift", "delete"])')
    assert result.startswith("ACTION_DENIED_BY_USER")
    stub_agent.actions.hotkey.assert_not_called()


def test_abort_during_approval_aborts_the_task(stub_agent, monkeypatch):
    monkeypatch.setattr(stub_agent, "_request_approval", lambda *a, **k: "aborted")
    assert stub_agent._execute_parsed_action('agent.launch(app_name="cmd")') == "USER_INTERVENTION_ABORTED"
    stub_agent.actions.launch_app.assert_not_called()


def test_approved_action_runs(stub_agent, monkeypatch):
    monkeypatch.setattr(stub_agent, "_request_approval", lambda *a, **k: "approved")
    result = stub_agent._execute_parsed_action('agent.hotkey(keys=["alt", "f4"])')
    assert "Pressed hotkey" in result
    stub_agent.actions.hotkey.assert_called_once()


def test_safety_mode_off_skips_prompts_but_not_blocks(stub_agent, monkeypatch):
    monkeypatch.setenv("RUXT_SAFETY_MODE", "off")
    asked = MagicMock(return_value="denied")
    monkeypatch.setattr(stub_agent, "_request_approval", asked)
    stub_agent._execute_parsed_action('agent.hotkey(keys=["alt", "f4"])')
    asked.assert_not_called()
    assert stub_agent._execute_parsed_action('agent.type(text="format c:")').startswith("BLOCKED_BY_SAFETY")


def test_safe_action_needs_no_approval(stub_agent, monkeypatch):
    asked = MagicMock(return_value="denied")
    monkeypatch.setattr(stub_agent, "_request_approval", asked)
    result = stub_agent._execute_parsed_action('agent.hotkey(keys=["ctrl", "s"])')
    asked.assert_not_called()
    assert "Pressed hotkey" in result


@pytest.mark.parametrize("signal,expected", [("approve.signal", "approved"), ("deny.signal", "denied"), ("abort.signal", "aborted")])
def test_request_approval_reads_signal_files(stub_agent, tmp_path, signal, expected):
    def write_later():
        time.sleep(0.5)
        (tmp_path / signal).write_text("x")

    threading.Thread(target=write_later, daemon=True).start()
    decision = stub_agent._request_approval("hotkey", "test reason", 'agent.hotkey(keys=["alt","f4"])', max_wait=10)
    assert decision == expected


def test_stale_signals_do_not_auto_approve(stub_agent, tmp_path):
    (tmp_path / "approve.signal").write_text("left over from an earlier request")
    decision = stub_agent._request_approval("hotkey", "test", "agent.hotkey()", max_wait=0.8)
    assert decision == "timeout"


def test_approval_times_out_as_denial(stub_agent):
    assert stub_agent._request_approval("hotkey", "test", "agent.hotkey()", max_wait=0.6) == "timeout"
