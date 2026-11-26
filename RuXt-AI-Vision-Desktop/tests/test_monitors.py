import importlib.util
from pathlib import Path

_path = Path(__file__).resolve().parent.parent / "ruxt_agent_s" / "core" / "monitors.py"
_spec = importlib.util.spec_from_file_location("ruxt_monitors", _path)
monitors = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(monitors)

# Layout of a real two-monitor setup: primary 1920x1080 at (0,0), second 2400x1350 at (2400,0)
PRIMARY = {"left": 0, "top": 0, "width": 1920, "height": 1080}
SECOND = {"left": 2400, "top": 0, "width": 2400, "height": 1350}


def test_window_center():
    assert monitors.window_center((0, 0, 100, 50)) == (50.0, 25.0)


def test_point_in_monitor_edges():
    assert monitors.point_in_monitor(0, 0, PRIMARY)
    assert monitors.point_in_monitor(1919, 1079, PRIMARY)
    assert not monitors.point_in_monitor(1920, 500, PRIMARY)  # first pixel outside
    assert not monitors.point_in_monitor(-1, 10, PRIMARY)


def test_window_on_primary_vs_second_monitor():
    assert monitors.window_on_monitor((100, 100, 900, 700), PRIMARY)
    assert not monitors.window_on_monitor((2500, 100, 3300, 700), PRIMARY)
    assert monitors.window_on_monitor((2500, 100, 3300, 700), SECOND)


def test_window_straddling_monitors_follows_its_center():
    # mostly on the primary monitor, spilling into the gap
    assert monitors.window_on_monitor((1000, 0, 2000, 800), PRIMARY)
    # mostly in the gap/second monitor
    assert not monitors.window_on_monitor((1800, 0, 3200, 800), PRIMARY)


def test_window_in_the_gap_between_monitors_is_on_neither():
    assert not monitors.window_on_monitor((1950, 0, 2350, 400), PRIMARY)
    assert not monitors.window_on_monitor((1950, 0, 2350, 400), SECOND)
