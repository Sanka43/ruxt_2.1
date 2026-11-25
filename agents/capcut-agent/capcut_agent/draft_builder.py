"""CapCut 9.x Draft Synthesizer & Project Generator."""

import json
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from capcut_agent.config import (
    CANVAS_PRESETS,
    CAPCUT_DRAFT_ROOT,
    DEFAULT_FPS,
    MICROSECOND,
    ROOT_META_INFO_PATH,
)


def generate_uuid() -> str:
    return str(uuid.uuid4()).upper()


def get_media_info(file_path: str) -> Dict:
    """Uses ffprobe to extract accurate duration and dimensions."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Media file not found: {file_path}")

    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        file_path,
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    data = json.loads(res.stdout)

    format_info = data.get("format", {})
    duration_sec = float(format_info.get("duration", 0))

    width = 1080
    height = 1920
    has_audio = False

    for stream in data.get("streams", []):
        codec_type = stream.get("codec_type")
        if codec_type == "video" and "width" in stream:
            width = int(stream["width"])
            height = int(stream["height"])
        elif codec_type == "audio":
            has_audio = True

    return {
        "duration_sec": duration_sec,
        "duration_us": int(duration_sec * MICROSECOND),
        "width": width,
        "height": height,
        "has_audio": has_audio,
    }


def generate_cover_thumbnail(video_path: str, output_jpg: str):
    """Extracts a frame at 0.5s as project cover."""
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-ss", "00:00:00.500",
                "-i", video_path,
                "-vframes", "1",
                "-q:v", "2",
                output_jpg,
            ],
            capture_output=True,
            check=True,
        )
    except Exception:
        # If ffmpeg fails, create an empty cover file
        Path(output_jpg).touch()


class CapCutDraftBuilder:
    def __init__(self, title: str = "New Project", aspect_ratio: str = "9:16"):
        self.title = title
        self.preset = CANVAS_PRESETS.get(aspect_ratio, CANVAS_PRESETS["9:16"])
        self.draft_id = generate_uuid()
        self.content_id = generate_uuid()
        
        # Project folder name: e.g. "Draft_20261119_160000" or title
        clean_title = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip()
        self.folder_name = clean_title or f"Draft_{int(time.time())}"
        self.draft_dir = CAPCUT_DRAFT_ROOT / self.folder_name

        self.video_clips: List[Dict] = []
        self.audio_clips: List[Dict] = []
        self.subtitles: List[Dict] = []

    def add_video(self, file_path: str, start_time_sec: float = 0.0, duration_sec: Optional[float] = None):
        info = get_media_info(file_path)
        clip_dur_us = int(duration_sec * MICROSECOND) if duration_sec else info["duration_us"]
        clip_start_us = int(start_time_sec * MICROSECOND)

        self.video_clips.append({
            "path": os.path.abspath(file_path).replace("\\", "/"),
            "source_start": clip_start_us,
            "duration": clip_dur_us,
            "width": info["width"],
            "height": info["height"],
            "has_audio": info["has_audio"],
        })

    def add_audio(self, file_path: str, start_timeline_sec: float = 0.0, duration_sec: Optional[float] = None, volume: float = 1.0):
        info = get_media_info(file_path)
        clip_dur_us = int(duration_sec * MICROSECOND) if duration_sec else info["duration_us"]

        self.audio_clips.append({
            "path": os.path.abspath(file_path).replace("\\", "/"),
            "target_start": int(start_timeline_sec * MICROSECOND),
            "duration": clip_dur_us,
            "volume": volume,
        })

    def add_subtitle(self, text: str, start_sec: float, duration_sec: float):
        self.subtitles.append({
            "text": text,
            "start_us": int(start_sec * MICROSECOND),
            "duration_us": int(duration_sec * MICROSECOND),
        })

    def build(self) -> Path:
        """Constructs all CapCut JSON files and updates root_meta_info.json."""
        self.draft_dir.mkdir(parents=True, exist_ok=True)

        # 1. Calculate Timeline duration
        total_video_duration = sum(c["duration"] for c in self.video_clips)
        total_duration = max(total_video_duration, 1_000_000)

        # 2. Build Materials & Tracks
        materials_videos = []
        materials_audios = []
        materials_texts = []
        materials_speeds = []
        materials_placeholders = []
        materials_canvases = []
        materials_colors = []
        materials_sound_mappings = []
        materials_vocals = []

        video_segments = []
        current_video_timeline = 0

        for clip in self.video_clips:
            mat_id = generate_uuid()
            seg_id = generate_uuid()
            speed_id = generate_uuid()
            placeholder_id = generate_uuid()
            canvas_id = generate_uuid()
            color_id = generate_uuid()
            sound_map_id = generate_uuid()
            vocal_id = generate_uuid()

            materials_speeds.append({"id": speed_id, "type": "speed", "mode": 0, "speed": 1.0, "curve_speed": None})
            materials_placeholders.append({"id": placeholder_id, "type": "placeholder_info", "meta_type": "none", "res_path": "", "res_text": "", "error_path": "", "error_text": ""})
            materials_canvases.append({"id": canvas_id, "type": "canvas_color", "color": "", "blur": 0.0, "image": "", "album_image": "", "image_id": "", "image_name": "", "source_platform": 0, "team_id": ""})
            materials_colors.append({"id": color_id, "is_color_clip": False, "is_gradient": False, "solid_color": "", "gradient_colors": [], "gradient_percents": [], "gradient_angle": 90.0, "width": 0.0, "height": 0.0})
            materials_sound_mappings.append({"id": sound_map_id, "type": "", "audio_channel_mapping": 0, "is_config_open": False})
            materials_vocals.append({"id": vocal_id, "type": "vocal_separation", "choice": 0, "removed_sounds": [], "time_range": None, "production_path": "", "final_algorithm": "", "enter_from": ""})

            materials_videos.append({
                "id": mat_id,
                "type": "video",
                "duration": clip["duration"],
                "path": clip["path"],
                "width": clip["width"],
                "height": clip["height"],
                "has_audio": clip["has_audio"],
                "material_name": os.path.basename(clip["path"]),
                "category_name": "local",
                "crop": {"upper_left_x": 0.0, "upper_left_y": 0.0, "upper_right_x": 1.0, "upper_right_y": 0.0, "lower_left_x": 0.0, "lower_left_y": 1.0, "lower_right_x": 1.0, "lower_right_y": 1.0},
                "check_flag": 62978047,
                "source": 0,
            })

            video_segments.append({
                "id": seg_id,
                "material_id": mat_id,
                "source_timerange": {"start": clip["source_start"], "duration": clip["duration"]},
                "target_timerange": {"start": current_video_timeline, "duration": clip["duration"]},
                "render_timerange": {"start": 0, "duration": 0},
                "speed": 1.0,
                "volume": 1.0,
                "clip": {"scale": {"x": 1.0, "y": 1.0}, "rotation": 0.0, "transform": {"x": 0.0, "y": 0.0}, "flip": {"vertical": False, "horizontal": False}, "alpha": 1.0},
                "uniform_scale": {"on": True, "value": 1.0},
                "extra_material_refs": [speed_id, placeholder_id, canvas_id, sound_map_id, color_id, vocal_id],
                "visible": True,
            })
            current_video_timeline += clip["duration"]

        tracks = []
        if video_segments:
            tracks.append({
                "id": generate_uuid(),
                "type": "video",
                "segments": video_segments,
                "flag": 0,
                "attribute": 0,
                "name": "Main Video",
                "is_default_name": True,
            })

        # Audio Track
        audio_segments = []
        for a_clip in self.audio_clips:
            a_mat_id = generate_uuid()
            a_seg_id = generate_uuid()
            materials_audios.append({
                "id": a_mat_id,
                "type": "music",
                "duration": a_clip["duration"],
                "path": a_clip["path"],
                "material_name": os.path.basename(a_clip["path"]),
                "category_name": "local",
                "check_flag": 1,
            })
            audio_segments.append({
                "id": a_seg_id,
                "material_id": a_mat_id,
                "source_timerange": {"start": 0, "duration": a_clip["duration"]},
                "target_timerange": {"start": a_clip["target_start"], "duration": a_clip["duration"]},
                "render_timerange": {"start": 0, "duration": 0},
                "speed": 1.0,
                "volume": a_clip["volume"],
                "visible": True,
            })

        if audio_segments:
            tracks.append({
                "id": generate_uuid(),
                "type": "audio",
                "segments": audio_segments,
                "flag": 0,
                "attribute": 0,
                "name": "Background Audio",
                "is_default_name": False,
            })

        # Subtitle / Text Track
        text_segments = []
        for sub in self.subtitles:
            t_mat_id = generate_uuid()
            t_seg_id = generate_uuid()

            sub_content = json.dumps({
                "styles": [{
                    "fill": {"alpha": 1.0, "content": {"render_type": "solid", "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}}},
                    "range": [0, len(sub["text"])],
                    "size": 10.0,
                }],
                "text": sub["text"],
            })

            materials_texts.append({
                "id": t_mat_id,
                "type": "subtitle",
                "name": "",
                "recognize_text": sub["text"],
                "content": sub_content,
                "base_content": sub_content,
                "global_alpha": 1.0,
                "text_color": "#FFFFFF",
                "text_alpha": 1.0,
                "font_size": 10.0,
                "alignment": 1,
                "check_flag": 7,
            })

            text_segments.append({
                "id": t_seg_id,
                "material_id": t_mat_id,
                "source_timerange": {"start": 0, "duration": sub["duration_us"]},
                "target_timerange": {"start": sub["start_us"], "duration": sub["duration_us"]},
                "render_timerange": {"start": 0, "duration": 0},
                "speed": 1.0,
                "volume": 1.0,
                "clip": {"scale": {"x": 1.0, "y": 1.0}, "rotation": 0.0, "transform": {"x": 0.0, "y": -0.75}, "flip": {"vertical": False, "horizontal": False}, "alpha": 1.0},
                "visible": True,
            })

        if text_segments:
            tracks.append({
                "id": generate_uuid(),
                "type": "text",
                "segments": text_segments,
                "flag": 0,
                "attribute": 0,
                "name": "Subtitles",
                "is_default_name": False,
            })

        # 3. Assemble draft_content.json
        now_us = int(time.time() * MICROSECOND)
        draft_content = {
            "id": self.content_id,
            "version": 360000,
            "new_version": "187.0.0",
            "name": self.title,
            "duration": total_duration,
            "create_time": int(time.time()),
            "update_time": int(time.time()),
            "fps": DEFAULT_FPS,
            "canvas_config": {
                "ratio": self.preset["ratio"],
                "width": self.preset["width"],
                "height": self.preset["height"],
                "background": None,
            },
            "tracks": tracks,
            "materials": {
                "videos": materials_videos,
                "audios": materials_audios,
                "texts": materials_texts,
                "speeds": materials_speeds,
                "canvases": materials_canvases,
                "placeholder_infos": materials_placeholders,
                "material_colors": materials_colors,
                "sound_channel_mappings": materials_sound_mappings,
                "vocal_separations": materials_vocals,
                "transitions": [],
                "video_effects": [],
                "stickers": [],
            },
            "keyframes": {"videos": [], "audios": [], "texts": [], "stickers": [], "filters": []},
            "platform": {"os": "windows", "os_version": "10.0.26300", "app_id": 359289, "app_version": "9.5.0", "app_source": "cc"},
            "last_modified_platform": {"os": "windows", "os_version": "10.0.26300", "app_id": 359289, "app_version": "9.5.0", "app_source": "cc"},
        }

        # Write draft_content.json
        draft_content_path = self.draft_dir / "draft_content.json"
        with open(draft_content_path, "w", encoding="utf-8") as f:
            json.dump(draft_content, f, indent=2, ensure_ascii=False)

        # 4. Generate cover image
        cover_path = self.draft_dir / "draft_cover.jpg"
        if self.video_clips:
            generate_cover_thumbnail(self.video_clips[0]["path"], str(cover_path))
        else:
            cover_path.touch()

        # 5. Build draft_meta_info.json
        draft_meta_info = {
            "draft_id": self.draft_id,
            "draft_name": self.folder_name,
            "draft_fold_path": str(self.draft_dir).replace("\\", "/"),
            "draft_root_path": str(CAPCUT_DRAFT_ROOT).replace("/", "\\"),
            "draft_cover": "draft_cover.jpg",
            "tm_draft_create": now_us,
            "tm_draft_modified": now_us,
            "tm_duration": total_duration,
            "draft_materials": [{"type": 0, "value": []}],
        }
        with open(self.draft_dir / "draft_meta_info.json", "w", encoding="utf-8") as f:
            json.dump(draft_meta_info, f, indent=2, ensure_ascii=False)

        # 6. Register into root_meta_info.json
        self._register_in_root_meta(total_duration, now_us)

        return self.draft_dir

    def _register_in_root_meta(self, total_duration_us: int, timestamp_us: int):
        root_data = {"all_draft_store": [], "draft_ids": 0, "root_path": str(CAPCUT_DRAFT_ROOT).replace("\\", "/")}
        if ROOT_META_INFO_PATH.exists():
            try:
                with open(ROOT_META_INFO_PATH, "r", encoding="utf-8") as f:
                    root_data = json.load(f)
            except Exception:
                pass

        all_draft_store = root_data.get("all_draft_store", [])
        
        # Remove any existing entry with same fold path to avoid duplicate
        fold_str = str(self.draft_dir).replace("\\", "/")
        all_draft_store = [d for d in all_draft_store if d.get("draft_fold_path", "").replace("\\", "/") != fold_str]

        # Prepend new draft so it's always at the very top
        new_store_entry = {
            "cloud_draft_cover": False,
            "cloud_draft_sync": False,
            "draft_cloud_last_action_download": False,
            "draft_cloud_purchase_info": "",
            "draft_cloud_template_id": "",
            "draft_cloud_tutorial_info": "",
            "draft_cloud_videocut_purchase_info": "",
            "draft_cover": f"{fold_str}/draft_cover.jpg",
            "draft_fold_path": fold_str,
            "draft_id": self.draft_id,
            "draft_is_ai_shorts": False,
            "draft_is_cloud_temp_draft": False,
            "draft_is_infinite_canvas_draft": False,
            "draft_is_invisible": False,
            "draft_is_pippit_draft": False,
            "draft_is_web_article_video": False,
            "draft_json_file": f"{fold_str}/draft_content.json",
            "draft_name": self.folder_name,
            "draft_new_version": "",
            "draft_root_path": str(CAPCUT_DRAFT_ROOT).replace("/", "\\"),
            "draft_timeline_materials_size": 1000000,
            "draft_type": "",
            "draft_web_article_video_enter_from": "",
            "pippit_avatar_url": "",
            "pippit_extra_info": "",
            "pippit_id": "",
            "pippit_user_name": "",
            "streaming_edit_draft_ready": True,
            "tm_draft_cloud_completed": "",
            "tm_draft_cloud_entry_id": -1,
            "tm_draft_cloud_modified": 0,
            "tm_draft_cloud_parent_entry_id": -1,
            "tm_draft_cloud_space_id": -1,
            "tm_draft_cloud_user_id": -1,
            "tm_draft_create": timestamp_us,
            "tm_draft_modified": timestamp_us,
            "tm_draft_removed": 0,
            "tm_duration": total_duration_us,
        }

        all_draft_store.insert(0, new_store_entry)
        root_data["all_draft_store"] = all_draft_store
        root_data["draft_ids"] = len(all_draft_store)

        with open(ROOT_META_INFO_PATH, "w", encoding="utf-8") as f:
            json.dump(root_data, f, indent=2, ensure_ascii=False)
