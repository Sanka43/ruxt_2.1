"""Pure helpers for reasoning about monitor geometry (no OS calls, easy to test).

The vision agent captures and clicks on the PRIMARY monitor only. These helpers let it notice
when the window it should be working on lives on another display, so the user can be told
instead of the AI silently clicking on the wrong screen.
"""

from typing import Mapping, Sequence


def window_center(rect: Sequence[int]) -> tuple:
    """Center of a (left, top, right, bottom) window rectangle."""
    left, top, right, bottom = rect
    return (left + right) / 2.0, (top + bottom) / 2.0


def point_in_monitor(x: float, y: float, monitor: Mapping[str, int]) -> bool:
    """True if a point lies inside a monitor given as {left, top, width, height}."""
    return (
        monitor["left"] <= x < monitor["left"] + monitor["width"]
        and monitor["top"] <= y < monitor["top"] + monitor["height"]
    )


def window_on_monitor(rect: Sequence[int], monitor: Mapping[str, int]) -> bool:
    """A window counts as being on a monitor when its center is on that monitor."""
    cx, cy = window_center(rect)
    return point_in_monitor(cx, cy, monitor)
