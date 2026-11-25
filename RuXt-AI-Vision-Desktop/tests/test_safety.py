"""Unit tests for the action safety gate (no screen, no GUI libraries needed)."""
import importlib.util
from pathlib import Path

import pytest

_path = Path(__file__).resolve().parent.parent / "ruxt_agent_s" / "core" / "safety.py"
_spec = importlib.util.spec_from_file_location("ruxt_safety", _path)
safety = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(safety)

ALLOW, CONFIRM, BLOCK = safety.ALLOW, safety.CONFIRM, safety.BLOCK
classify = safety.classify_action


@pytest.mark.parametrize("text", [
    "format c:",
    "rm -rf /",
    "rm -rf /*",
    "del /s /q C:\\Windows",
    "rmdir /s /q C:\\",
    "DROP DATABASE prod;",
    "reg delete HKLM\\Software\\X",
    "diskpart",
    "shutdown /s /t 0",
    "Format-Volume -DriveLetter D",
])
def test_destructive_typed_commands_are_blocked(text):
    assert classify("type", [], {"text": text}).level == BLOCK


@pytest.mark.parametrize("text", [
    "Remove-Item C:\\temp\\x.txt",
    "del notes.txt",
    "taskkill /im chrome.exe",
    "powershell -c ls",
    "curl http://example.com/x.sh",
])
def test_shell_commands_need_confirmation(text):
    assert classify("type", [text]).level == CONFIRM


@pytest.mark.parametrize("text", [
    "Hello world, please format the report nicely",
    "meeting notes for tomorrow",
    "https://example.com",
    "I want to remove the old logo from the slide",
])
def test_normal_typing_is_allowed(text):
    assert classify("type", [], {"text": text}).level == ALLOW


@pytest.mark.parametrize("desc", [
    "Delete button",
    "Uninstall",
    "Empty Recycle Bin",
    "Pay now",
    "Place your order",
    "Log out",
])
def test_irreversible_clicks_need_confirmation(desc):
    assert classify("click", [], {"description": desc}).level == CONFIRM
    assert classify("click_control", [desc]).level == CONFIRM


@pytest.mark.parametrize("desc", ["Save", "File menu", "Search box", "Paypal logo", ""])
def test_ordinary_clicks_are_allowed(desc):
    assert classify("click", [], {"description": desc}).level == ALLOW


@pytest.mark.parametrize("keys", [
    ["shift", "delete"], ["ctrl", "alt", "delete"], ["alt", "f4"], ["win", "r"],
    ["Control", "Shift", "Del"], "ctrl+shift+esc",
])
def test_dangerous_hotkeys_need_confirmation(keys):
    assert classify("hotkey", [keys]).level == CONFIRM


@pytest.mark.parametrize("keys", [["ctrl", "c"], ["ctrl", "s"], ["alt", "tab"], ["enter"]])
def test_normal_hotkeys_are_allowed(keys):
    assert classify("hotkey", [], {"keys": keys}).level == ALLOW


def test_launching_shells_needs_confirmation_but_normal_apps_do_not():
    for app in ["cmd", "PowerShell.exe", "C:\\Windows\\System32\\regedit.exe", "wt"]:
        assert classify("launch", [app]).level == CONFIRM, app
    for app in ["notepad", "chrome", "C:\\Program Files\\Blender\\blender.exe"]:
        assert classify("launch", [app]).level == ALLOW, app


def test_unknown_or_empty_actions_are_allowed():
    assert classify("scroll", [-300]).level == ALLOW
    assert classify("wait", [2]).level == ALLOW
    assert classify("type").level == ALLOW


def test_safety_mode_env(monkeypatch):
    monkeypatch.delenv("RUXT_SAFETY_MODE", raising=False)
    assert safety.safety_mode() == "confirm"
    monkeypatch.setenv("RUXT_SAFETY_MODE", "off")
    assert safety.safety_mode() == "off"
    monkeypatch.setenv("RUXT_SAFETY_MODE", "garbage")
    assert safety.safety_mode() == "confirm"
