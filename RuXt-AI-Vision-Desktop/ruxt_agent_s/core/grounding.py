import ast
import base64
import io
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import httpx

logger = logging.getLogger("ruxt_agent_s.grounding")

@dataclass
class UIBox:
    box_id: int
    bbox: Tuple[int, int, int, int]  # (x1, y1, x2, y2) in pixel space
    center: Tuple[int, int]          # (cx, cy) in pixel space
    label: str                       # e.g., "Search", "Close", "OK", "Icon"
    element_type: str                # "button", "input", "text", "icon", "menu"
    interactable: bool = True

class SetOfMarksEngine:
    """
    Set-of-Marks (SOM) overlay engine for Microsoft OmniParser v2 integration.
    Renders high-visibility numbered badges and bounding boxes on UI screenshots.
    """
    # Palette of vibrant, easily distinguishable badge colors
    PALETTE = [
        (230, 25, 75),    # Red
        (60, 180, 75),    # Green
        (255, 225, 25),   # Yellow
        (0, 130, 200),    # Blue
        (245, 130, 48),   # Orange
        (145, 30, 180),   # Purple
        (70, 240, 240),   # Cyan
        (240, 50, 230),   # Magenta
        (210, 245, 60),   # Lime
        (0, 128, 128),    # Teal
        (170, 110, 40),   # Brown
        (128, 0, 0),      # Maroon
        (0, 0, 128),      # Navy
    ]

    def __init__(self):
        self._font = None
        self._load_font()

    def _load_font(self):
        try:
            # Try Windows system font
            self._font = ImageFont.truetype("arial.ttf", 13)
        except Exception:
            try:
                self._font = ImageFont.truetype("segoeui.ttf", 13)
            except Exception:
                self._font = ImageFont.load_default()

    def draw_som_overlay(
        self,
        image: Image.Image,
        boxes: List[UIBox]
    ) -> Image.Image:
        """
        Draws numbered bounding boxes and tags on a copy of the input image.
        Returns a new annotated PIL Image.
        """
        annotated = image.copy().convert("RGBA")
        overlay = Image.new("RGBA", annotated.size, (255, 255, 255, 0))
        draw_overlay = ImageDraw.Draw(overlay)
        draw_annotated = ImageDraw.Draw(annotated)

        img_w, img_h = annotated.size

        for box in boxes:
            x1, y1, x2, y2 = box.bbox
            x1 = max(0, min(x1, img_w - 1))
            y1 = max(0, min(y1, img_h - 1))
            x2 = max(0, min(x2, img_w - 1))
            y2 = max(0, min(y2, img_h - 1))

            color = self.PALETTE[box.box_id % len(self.PALETTE)]
            border_rgba = color + (200,)
            fill_rgba = color + (25,)  # Subtle transparent tint

            # Draw bounding box
            draw_overlay.rectangle([x1, y1, x2, y2], outline=border_rgba, width=2)
            draw_overlay.rectangle([x1, y1, x2, y2], fill=fill_rgba)

            # Draw numbered badge label at top-left corner
            badge_text = f" {box.box_id} "
            try:
                left, top, right, bottom = draw_annotated.textbbox((0, 0), badge_text, font=self._font)
                tw = right - left
                th = bottom - top
            except Exception:
                tw, th = len(badge_text) * 7, 13

            bx1 = x1
            by1 = max(0, y1 - th - 4) if y1 >= th + 4 else y1
            bx2 = min(img_w - 1, bx1 + tw + 4)
            by2 = min(img_h - 1, by1 + th + 4)

            # Badge background
            draw_overlay.rectangle([bx1, by1, bx2, by2], fill=color + (240,))
            draw_overlay.rectangle([bx1, by1, bx2, by2], outline=(255, 255, 255, 240), width=1)

        # Composite overlay onto main image
        annotated = Image.alpha_composite(annotated, overlay).convert("RGB")
        draw_final = ImageDraw.Draw(annotated)

        # Draw text labels on top to ensure crisp readability
        for box in boxes:
            x1, y1, x2, y2 = box.bbox
            try:
                left, top, right, bottom = draw_final.textbbox((0, 0), f" {box.box_id} ", font=self._font)
                th = bottom - top
            except Exception:
                th = 13

            bx1 = x1 + 2
            by1 = (max(0, y1 - th - 4) if y1 >= th + 4 else y1) + 1
            # White text with black shadow for readability
            badge_text = f"{box.box_id}"
            draw_final.text((bx1 + 1, by1 + 1), badge_text, fill=(0, 0, 0), font=self._font)
            draw_final.text((bx1, by1), badge_text, fill=(255, 255, 255), font=self._font)

        return annotated


class OmniParserV2Grounder:
    """
    Microsoft OmniParser v2 Grounding Engine for RuXt AI Vision Desktop.
    Provides Set-of-Marks (SOM) clickable icon and control parsing:
      1. Hybrid Mode: Fast UIA control discovery + Visual element detection.
      2. Endpoint Mode: Calls remote/local Microsoft OmniParser v2 server (`POST /parse`).
      3. Set-of-Marks Annotation: Outputs tagged image + Box ID coordinate mapping.
    """
    def __init__(
        self,
        screen_width: int,
        screen_height: int,
        mode: str = "hybrid",
        endpoint: str = "",
        timeout: float = 10.0
    ):
        self.screen_width = screen_width
        self.screen_height = screen_height
        self.mode = mode.lower()
        self.endpoint = endpoint.rstrip("/")
        self.timeout = timeout
        self.som_engine = SetOfMarksEngine()
        self.current_boxes: Dict[int, UIBox] = {}

    def parse_screen(
        self,
        image: Image.Image,
        active_window_title: str = ""
    ) -> Tuple[Image.Image, Dict[int, UIBox], str]:
        """
        Parses screenshot and extracts interactive elements.
        Returns:
            - tagged_image (PIL Image with Set-of-Marks numbered badges)
            - box_map (Dict mapping box_id -> UIBox)
            - som_summary_text (Text listing detected boxes for LLM prompt)
        """
        boxes: List[UIBox] = []

        # 1. Try remote Microsoft OmniParser v2 endpoint if configured
        if self.endpoint:
            boxes = self._parse_via_endpoint(image)

        # 2. If endpoint not configured or returned no boxes, use Hybrid UIA + Visual engine
        if not boxes:
            boxes = self._parse_hybrid(image, active_window_title)

        # Build box_map
        self.current_boxes = {b.box_id: b for b in boxes}

        # Render Set-of-Marks overlay
        tagged_img = self.som_engine.draw_som_overlay(image, boxes)

        # Build summary text for LLM
        summary_lines = []
        for b in boxes:
            lbl = f" '{b.label}'" if b.label else ""
            summary_lines.append(f"Box [{b.box_id}]: {b.element_type}{lbl} at center ({b.center[0]}, {b.center[1]})")

        som_summary = "\n".join(summary_lines) if summary_lines else "No distinct interactive boxes detected."
        return tagged_img, self.current_boxes, som_summary

    def _parse_via_endpoint(self, image: Image.Image) -> List[UIBox]:
        """Calls external Microsoft OmniParser v2 HTTP server."""
        try:
            buffered = io.BytesIO()
            image.save(buffered, format="JPEG", quality=85)
            img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

            url = f"{self.endpoint}/parse"
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(url, json={"base64_image": img_b64})
                if resp.status_code == 200:
                    data = resp.json()
                    parsed_boxes: List[UIBox] = []
                    # Standard OmniParser v2 response format
                    elements = data.get("parsed_content_list", []) or data.get("elements", [])
                    for idx, el in enumerate(elements):
                        bbox = el.get("bbox", [0, 0, 0, 0])
                        # Convert normalized bbox [ymin, xmin, ymax, xmax] or [x1, y1, x2, y2]
                        if len(bbox) == 4:
                            x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
                            cx = (x1 + x2) // 2
                            cy = (y1 + y2) // 2
                            label = el.get("content", "") or el.get("text", "")
                            el_type = el.get("type", "icon")
                            parsed_boxes.append(UIBox(
                                box_id=idx,
                                bbox=(x1, y1, x2, y2),
                                center=(cx, cy),
                                label=label[:30],
                                element_type=el_type
                            ))
                    if parsed_boxes:
                        logger.info(f"OmniParser endpoint returned {len(parsed_boxes)} parsed elements")
                        return parsed_boxes
        except Exception as ex:
            logger.warning(f"OmniParser v2 endpoint call failed, falling back to hybrid: {ex}")
        return []

    def _parse_hybrid(self, image: Image.Image, active_window_title: str) -> List[UIBox]:
        """
        Fast, zero-setup local hybrid detector:
        Combines Windows UIA controls (pywinauto) + visual layout heuristics.
        """
        boxes: List[UIBox] = []
        box_id = 0
        img_w, img_h = image.size

        # 1. Query Windows UIA controls if on Windows
        try:
            import pywinauto
            from pywinauto import Desktop
            desktop = Desktop(backend="uia")
            windows = desktop.windows(visible_only=True)
            for win in windows[:4]:
                try:
                    for child in win.descendants():
                        if box_id >= 40:  # Cap at top 40 interactive elements to keep prompt concise
                            break
                        ctrl_type = (child.element_info.control_type or "").strip().lower()
                        name = (child.element_info.name or "").strip()
                        auto_id = (child.element_info.automation_id or "").strip()

                        # Check if control is clickable/actionable
                        if ctrl_type in ["button", "edit", "menuitem", "tabitem", "hyperlink", "checkbox", "radiobutton", "combobox"]:
                            rect = child.rectangle()
                            w = rect.width()
                            h = rect.height()
                            if 8 <= w <= (img_w * 0.95) and 8 <= h <= (img_h * 0.5):
                                x1, y1 = max(0, rect.left), max(0, rect.top)
                                x2, y2 = min(img_w - 1, rect.right), min(img_h - 1, rect.bottom)
                                cx = (x1 + x2) // 2
                                cy = (y1 + y2) // 2
                                label = name or auto_id
                                boxes.append(UIBox(
                                    box_id=box_id,
                                    bbox=(x1, y1, x2, y2),
                                    center=(cx, cy),
                                    label=label[:25],
                                    element_type=ctrl_type
                                ))
                                box_id += 1
                except Exception:
                    continue
        except Exception as e:
            logger.debug(f"UIA scan in hybrid mode notice: {e}")

        # 2. If UIA returned few elements (e.g. Chrome canvas, game, or non-UIA app),
        # perform lightweight PIL edge/contrast bounding box detection
        if len(boxes) < 8:
            visual_boxes = self._detect_visual_components(image, start_id=box_id)
            boxes.extend(visual_boxes[:(50 - len(boxes))])

        return boxes

    def _detect_visual_components(self, image: Image.Image, start_id: int = 0) -> List[UIBox]:
        """Detects prominent rectangular UI components and icons using PIL filters."""
        detected: List[UIBox] = []
        box_id = start_id
        img_w, img_h = image.size

        try:
            # Downsample for lightning-fast edge analysis
            thumb_scale = 2
            small = image.resize((img_w // thumb_scale, img_h // thumb_scale), Image.Resampling.BILINEAR)
            gray = small.convert("L")
            edges = gray.filter(ImageFilter.FIND_EDGES)
            # Threshold edges
            binary = edges.point(lambda p: 255 if p > 75 else 0)

            # Sample grid blocks to identify high-density interactive UI clusters
            block_size = 32 // thumb_scale
            cols = small.width // block_size
            rows = small.height // block_size

            for r in range(rows):
                for c in range(cols):
                    if box_id >= 45:
                        break
                    bx = c * block_size
                    by = r * block_size
                    box_crop = binary.crop((bx, by, bx + block_size, by + block_size))
                    # Compute edge density
                    stat = list(box_crop.getdata())
                    white_count = sum(1 for p in stat if p > 128)
                    density = white_count / max(1, len(stat))

                    # Icons and buttons have edge densities between 8% and 40%
                    if 0.08 <= density <= 0.40:
                        x1 = bx * thumb_scale
                        y1 = by * thumb_scale
                        x2 = min(img_w - 1, (bx + block_size) * thumb_scale)
                        y2 = min(img_h - 1, (by + block_size) * thumb_scale)
                        cx = (x1 + x2) // 2
                        cy = (y1 + y2) // 2

                        # Avoid overlapping duplicates
                        is_duplicate = False
                        for b in detected:
                            if abs(b.center[0] - cx) < 24 and abs(b.center[1] - cy) < 24:
                                is_duplicate = True
                                break

                        if not is_duplicate:
                            detected.append(UIBox(
                                box_id=box_id,
                                bbox=(x1, y1, x2, y2),
                                center=(cx, cy),
                                label="",
                                element_type="icon"
                            ))
                            box_id += 1
        except Exception as ex:
            logger.debug(f"Visual component detection notice: {ex}")

        return detected

    def resolve_box(self, box_id: int) -> Optional[Tuple[int, int]]:
        """Resolves a box_id to exact (cx, cy) pixel coordinates."""
        if box_id in self.current_boxes:
            return self.current_boxes[box_id].center
        return None


class VisualGrounder:
    """
    Translates visual predictions, normalized coordinates, and OmniParser box IDs to screen pixel space.
    Compatible with Agent-S, Microsoft OmniParser v2, UI-TARS, Claude Computer-Use, and GPT-4o formats.
    """
    def __init__(
        self,
        screen_width: int,
        screen_height: int,
        coordinate_scale: int = 1000,
        omniparser_grounder: Optional[OmniParserV2Grounder] = None
    ):
        self.screen_width = screen_width
        self.screen_height = screen_height
        self.coordinate_scale = coordinate_scale
        self.omniparser = omniparser_grounder

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

        # Clamp to screen bounds
        px = max(0, min(px, self.screen_width - 1))
        py = max(0, min(py, self.screen_height - 1))
        return px, py

    def resolve_box_id(self, box_id: int) -> Optional[Tuple[int, int]]:
        """Resolves an OmniParser Set-of-Marks box ID to screen pixel coordinates."""
        if self.omniparser:
            return self.omniparser.resolve_box(box_id)
        return None

    def extract_coordinates(self, text: str) -> Optional[Tuple[int, int]]:
        """
        Parses coordinates from text patterns:
        - Box ID: box_id=5, box 5, [5], #5
        - UI-TARS / Qwen: start_box='(x, y)', point='[x, y]'
        - Standard: (x, y), [x, y], x=..., y=...
        """
        # Pattern 0: OmniParser Box ID reference
        box_pattern = r"(?:box_id\s*=\s*|box\s*|#\s*)(\d+)"
        box_match = re.search(box_pattern, text, re.IGNORECASE)
        if box_match and self.omniparser:
            bid = int(box_match.group(1))
            coords = self.resolve_box_id(bid)
            if coords:
                return coords

        # Pattern 1: UI-TARS start_box or point
        uitars_pattern = r"(?:start_box|point)\s*=\s*['\"]?[\[\(]\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*[\]\)]['\"]?"
        match = re.search(uitars_pattern, text, re.IGNORECASE)
        if match:
            x, y = float(match.group(1)), float(match.group(2))
            return self.normalize_to_pixels(x, y)

        # Pattern 2: [x, y] or (x, y)
        bracket_pattern = r"[\[\(]\s*(\d{1,4}(?:\.\d+)?)\s*,\s*(\d{1,4}(?:\.\d+)?)\s*[\]\)]"
        match = re.search(bracket_pattern, text)
        if match:
            x, y = float(match.group(1)), float(match.group(2))
            return self.normalize_to_pixels(x, y)

        # Pattern 3: x=..., y=...
        kw_pattern = r"x\s*=\s*(\d+(?:\.\d+)?)\s*,\s*y\s*=\s*(\d+(?:\.\d+)?)"
        match = re.search(kw_pattern, text)
        if match:
            x, y = float(match.group(1)), float(match.group(2))
            return self.normalize_to_pixels(x, y)

        return None
