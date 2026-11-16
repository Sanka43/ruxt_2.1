import ast
import re
from typing import Any, Dict, List, Optional, Tuple

class VisualGrounder:
    """
    Translates visual predictions and normalized coordinates to screen pixel space.
    Compatible with Agent-S, UI-TARS, Claude Computer-Use, and GPT-4o formats.
    """
    def __init__(self, screen_width: int, screen_height: int, coordinate_scale: int = 1000):
        self.screen_width = screen_width
        self.screen_height = screen_height
        self.coordinate_scale = coordinate_scale

    def normalize_to_pixels(self, x: float, y: float) -> Tuple[int, int]:
        """Convert normalized (0-1000 or 0.0-1.0) coordinates into absolute screen pixels."""
        if 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0:
            px = int(x * self.screen_width)
            py = int(y * self.screen_height)
        elif 0 <= x <= self.coordinate_scale and 0 <= y <= self.coordinate_scale:
            px = int((x / self.coordinate_scale) * self.screen_width)
            py = int((y / self.coordinate_scale) * self.screen_height)
        else:
            # Assume already in pixel space
            px = int(x)
            py = int(y)

        # Clamp to bounds
        px = max(0, min(px, self.screen_width - 1))
        py = max(0, min(py, self.screen_height - 1))
        return px, py

    def extract_coordinates(self, text: str) -> Optional[Tuple[int, int]]:
        """Parses coordinates from text patterns like (x, y), [x, y], point=[x, y]."""
        # Pattern 1: [x, y] or (x, y)
        bracket_pattern = r"[\[\(]\s*(\d{1,4}(?:\.\d+)?)\s*,\s*(\d{1,4}(?:\.\d+)?)\s*[\]\)]"
        match = re.search(bracket_pattern, text)
        if match:
            x, y = float(match.group(1)), float(match.group(2))
            return self.normalize_to_pixels(x, y)

        # Pattern 2: x=..., y=...
        kw_pattern = r"x\s*=\s*(\d+(?:\.\d+)?)\s*,\s*y\s*=\s*(\d+(?:\.\d+)?)"
        match = re.search(kw_pattern, text)
        if match:
            x, y = float(match.group(1)), float(match.group(2))
            return self.normalize_to_pixels(x, y)

        return None
