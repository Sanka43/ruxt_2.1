import logging
import platform
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("ruxt_agent_s.uia")

class WindowsUIAGrounder:
    """
    Leverages Windows UI Automation (UIA) to discover native controls and their exact bounding boxes.
    """
    def __init__(self):
        self.is_windows = platform.system() == "Windows"
        self._uia_available = False
        if self.is_windows:
            try:
                import pywinauto
                from pywinauto import Desktop
                self.desktop = Desktop(backend="uia")
                self._uia_available = True
            except Exception as e:
                logger.warning(f"Windows UIA init failed: {e}")

    def find_element_bounds(self, query: str, active_window_only: bool = True) -> Optional[Tuple[int, int]]:
        """
        Attempts to locate a UI element by text or control name.
        Returns the center coordinates (x, y) if found.
        """
        if not self._uia_available:
            return None

        try:
            from pywinauto import Desktop
            q_lower = query.lower().strip()
            
            # Search visible windows
            windows = self.desktop.windows(visible_only=True)
            for win in windows[:5]:  # Focus on top 5 visible windows
                try:
                    for child in win.descendants():
                        name = (child.element_info.name or "").strip().lower()
                        auto_id = (child.element_info.automation_id or "").strip().lower()
                        ctrl_type = (child.element_info.control_type or "").strip().lower()
                        
                        if q_lower in name or q_lower == auto_id:
                            rect = child.rectangle()
                            if rect.width() > 0 and rect.height() > 0:
                                cx = (rect.left + rect.right) // 2
                                cy = (rect.top + rect.bottom) // 2
                                logger.info(f"UIA Grounded '{query}' -> ({cx}, {cy}) [{ctrl_type}]")
                                return cx, cy
                except Exception:
                    continue
        except Exception as e:
            logger.debug(f"UIA lookup exception: {e}")

        return None
