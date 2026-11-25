"""Action-level safety gate for the vision agent.

The model proposes actions; this module decides, *before* anything touches the
mouse or keyboard, whether an action is fine, needs the user's explicit approval,
or must never run. It has no third-party dependencies so it is easy to test.

  ALLOW   - run normally
  CONFIRM - pause and ask the user (Approve / Deny in the HUD)
  BLOCK   - never run; the model is told to pick another approach

RUXT_SAFETY_MODE=off disables the CONFIRM prompts (BLOCK always applies).
"""

import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List

ALLOW = "allow"
CONFIRM = "confirm"
BLOCK = "block"


@dataclass(frozen=True)
class Verdict:
    level: str = ALLOW
    reason: str = ""


# Typed text that must never be sent to a shell / terminal / run box.
_BLOCK_TEXT = [
    re.compile(r"\bformat\s+[a-z]:", re.I),
    re.compile(r"\bformat-volume\b|\bclear-disk\b", re.I),
    re.compile(r"\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+/(\s|$|\*)", re.I),
    re.compile(r"\bdel\s+/[sfq]\b.*[a-z]:\\", re.I),
    re.compile(r"\brmdir\s+/s\s+/q\s+[a-z]:\\", re.I),
    re.compile(r"\bdrop\s+(database|table)\b", re.I),
    re.compile(r"\breg\s+delete\s+hk(lm|cr)\b", re.I),
    re.compile(r"\bdiskpart\b", re.I),
    re.compile(r"\bshutdown\s+/[srp]\b", re.I),
    re.compile(r"\bcipher\s+/w\b", re.I),
]

# Typed text that starts like a shell command that changes or removes things.
_CONFIRM_COMMAND = re.compile(
    r"^\s*(rm|del|erase|rmdir|rd|remove-item|taskkill|stop-process|reg|net|schtasks|"
    r"iex|invoke-expression|invoke-webrequest|curl|wget|powershell|pwsh|cmd)\b",
    re.I,
)

# Click targets (the model's own description of what it clicks) that are hard to undo.
_CONFIRM_CLICK = re.compile(
    r"\b(delete|remove|erase|uninstall|wipe|purge|factory reset|reset (all|settings|pc)|"
    r"empty (the )?recycle bin|permanently|format (drive|disk)|"
    r"pay( now)?|purchase|buy( now)?|place (your )?order|checkout|confirm (payment|purchase|order)|"
    r"submit (order|payment)|transfer|withdraw|send (money|payment)|publish|sign out|log ?out)\b",
    re.I,
)

# Key combinations that destroy data or open a privileged entry point.
_CONFIRM_HOTKEYS = [
    frozenset({"shift", "delete"}),
    frozenset({"shift", "del"}),
    frozenset({"ctrl", "shift", "delete"}),
    frozenset({"ctrl", "alt", "delete"}),
    frozenset({"ctrl", "alt", "del"}),
    frozenset({"alt", "f4"}),
    frozenset({"win", "r"}),
    frozenset({"winleft", "r"}),
    frozenset({"ctrl", "shift", "esc"}),
]

# Programs that give a shell or system-level control.
_CONFIRM_APPS = {
    "cmd", "powershell", "pwsh", "wt", "windowsterminal", "regedit", "diskpart",
    "mmc", "gpedit", "taskschd", "services", "compmgmt", "eventvwr",
}


def safety_mode() -> str:
    """'confirm' (default) or 'off'."""
    return "off" if os.environ.get("RUXT_SAFETY_MODE", "confirm").strip().lower() == "off" else "confirm"


def _as_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, Iterable):
        return [str(v) for v in value]
    return [str(value)]


def _norm_key(key: str) -> str:
    k = str(key).strip().lower()
    return {"control": "ctrl", "del": "delete", "windows": "win", "escape": "esc"}.get(k, k)


def _hotkey_set(raw: Any) -> frozenset:
    parts: List[str] = []
    for item in _as_list(raw):
        parts.extend(p for p in re.split(r"[+\s,]+", item) if p)
    return frozenset(_norm_key(p) for p in parts)


def _app_basename(name: str) -> str:
    base = re.split(r"[\\/]", str(name).strip().strip('"'))[-1].lower()
    return re.sub(r"\.(exe|msc|lnk)$", "", base)


def classify_action(func_name: str, args: List[Any] = None, kwargs: Dict[str, Any] = None) -> Verdict:
    """Classify one parsed agent action."""
    args = list(args or [])
    kwargs = dict(kwargs or {})

    if func_name in ("click", "double_click", "right_click"):
        desc = str(kwargs.get("description", "") or "")
        if desc and _CONFIRM_CLICK.search(desc):
            return Verdict(CONFIRM, f'Click on "{desc[:80]}" may be hard to undo')

    elif func_name == "click_control":
        query = str(kwargs.get("query", args[0] if args else "") or "")
        if query and _CONFIRM_CLICK.search(query):
            return Verdict(CONFIRM, f'Click on "{query[:80]}" may be hard to undo')

    elif func_name == "type":
        text = str(kwargs.get("text", args[0] if args else "") or "")
        for pattern in _BLOCK_TEXT:
            if pattern.search(text):
                return Verdict(BLOCK, "Typed text contains a destructive system command")
        if _CONFIRM_COMMAND.match(text):
            return Verdict(CONFIRM, f'About to type a shell command: "{text[:80]}"')

    elif func_name == "hotkey":
        combo = _hotkey_set(kwargs.get("keys", args[0] if args else []))
        if combo in _CONFIRM_HOTKEYS:
            return Verdict(CONFIRM, f"Hotkey {'+'.join(sorted(combo))} can delete data or open a privileged tool")

    elif func_name == "press_key":
        combo = _hotkey_set(kwargs.get("key", args[0] if args else ""))
        if combo in _CONFIRM_HOTKEYS:
            return Verdict(CONFIRM, f"Key {'+'.join(sorted(combo))} can delete data or open a privileged tool")

    elif func_name == "launch":
        app = _app_basename(kwargs.get("app_name", args[0] if args else ""))
        if app in _CONFIRM_APPS:
            return Verdict(CONFIRM, f'Launching "{app}" gives shell or system-level control')

    return Verdict(ALLOW)
