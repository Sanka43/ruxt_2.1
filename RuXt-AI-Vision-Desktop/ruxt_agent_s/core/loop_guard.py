"""Detects an agent that keeps repeating the exact same action without making progress.

An LLM that misreads the screen can click the same button forever, burning API calls
and (worse) repeating a side effect. The guard warns first, then stops the task.
"""

import re
from typing import Iterable

OK = "ok"
WARN = "warn"
STOP = "stop"

# Repeating these is normal (waiting, scrolling a list, arrow-key navigation)
_DEFAULT_IGNORED = ("wait", "scroll", "press_key")


def _func_name(action: str) -> str:
    match = re.match(r"\s*(?:agent\.)?([a-z_]+)\s*\(", action or "")
    return match.group(1) if match else ""


class LoopGuard:
    def __init__(self, warn_after: int = 4, stop_after: int = 8, ignored: Iterable[str] = _DEFAULT_IGNORED):
        if stop_after <= warn_after:
            raise ValueError("stop_after must be greater than warn_after")
        self.warn_after = warn_after
        self.stop_after = stop_after
        self.ignored = set(ignored)
        self.reset()

    def reset(self) -> None:
        self._last = None
        self._count = 0

    def record(self, action: str, result: str) -> str:
        """Record an executed action and its result. Returns OK, WARN (once) or STOP."""
        if _func_name(action) in self.ignored:
            return OK

        key = (re.sub(r"\s+", " ", (action or "").strip()), (result or "").strip())
        if key == self._last:
            self._count += 1
        else:
            self._last = key
            self._count = 1

        if self._count >= self.stop_after:
            return STOP
        if self._count == self.warn_after:
            return WARN
        return OK
