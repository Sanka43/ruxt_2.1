import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from pydantic import BaseModel, Field

class GroundingConfig(BaseModel):
    use_omniparser: bool = True
    omniparser_mode: str = "hybrid"
    omniparser_endpoint: str = ""
    use_uia_tree: bool = False
    coordinate_scale: int = 1000
    screenshot_max_width: int = 1280
    screenshot_max_height: int = 720
    fast_mode: bool = True

class ExecutionConfig(BaseModel):
    cursor_mode: str = "direct"
    mouse_move_duration: float = 0.20
    action_delay: float = 0.10
    type_via_clipboard: bool = False
    typing_interval: float = 0.025
    failsafe: bool = True
    independent_cursor: bool = False
    hybrid_uia_pyautogui: bool = True

class AgentConfig(BaseModel):
    max_steps: int = 25
    enable_reflection: bool = True
    allow_action_chaining: bool = True
    max_chain_length: int = 5
    log_level: str = "INFO"
    data_dir: str = "data"

class AppConfig(BaseModel):
    provider: str = "gemini"
    model: str = "gemini-3.5-flash"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    grounding: GroundingConfig = Field(default_factory=GroundingConfig)
    execution: ExecutionConfig = Field(default_factory=ExecutionConfig)
    agent: AgentConfig = Field(default_factory=AgentConfig)

def _load_ruxt_sqlite_settings(root_dir: Path) -> Dict[str, str]:
    """Discovers and loads settings key-values from RuXt SQLite database."""
    settings: Dict[str, str] = {}
    candidates = [
        Path(os.environ.get("APPDATA", "")) / "ruxt-desktop" / "data" / "ruxt.sqlite",
        Path(os.environ.get("APPDATA", "")) / "RuXt" / "data" / "ruxt.sqlite",
        root_dir.parent / "data" / "ruxt.sqlite",
        root_dir.parent / "data" / "ruxt.db",
    ]

    for db_path in candidates:
        if db_path.exists():
            try:
                conn = sqlite3.connect(str(db_path), timeout=2.0)
                cursor = conn.cursor()
                cursor.execute("SELECT key, value FROM settings")
                for key, val in cursor.fetchall():
                    if key and val and not str(val).startswith("enc:v1:"):
                        settings[str(key).strip()] = str(val).strip()
                conn.close()
                if settings:
                    break
            except Exception:
                continue
    return settings

def load_config(config_path: Optional[str] = None) -> AppConfig:
    """Loads configuration from YAML, RuXt SQLite DB, and environment variables."""
    root_dir = Path(__file__).resolve().parent.parent
    cfg_file = Path(config_path) if config_path else root_dir / "config.yaml"
    
    data: Dict[str, Any] = {}
    if cfg_file.exists():
        with open(cfg_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

    config = AppConfig(**data)

    # Load persistent settings from RuXt SQLite database
    db_settings = _load_ruxt_sqlite_settings(root_dir)

    # Speed-Priority Resolution:
    # If provider is "auto" or empty, resolve by speed priority
    requested_provider = os.getenv("RUXT_VISION_PROVIDER") or os.getenv("AI_PROVIDER") or config.provider
    if requested_provider in ["auto", "", None]:
        gemini_key = db_settings.get("gemini_api_key") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        openai_key = db_settings.get("openai_api_key") or os.getenv("OPENAI_API_KEY")
        anthropic_key = db_settings.get("anthropic_api_key") or os.getenv("ANTHROPIC_API_KEY")

        if gemini_key and len(gemini_key) > 10:
            config.provider = "gemini"
            config.model = db_settings.get("gemini_model") or "gemini-3.5-flash"
            config.api_key = gemini_key
        elif anthropic_key and len(anthropic_key) > 10:
            config.provider = "anthropic"
            config.model = db_settings.get("anthropic_model") or "claude-3-5-sonnet-20241022"
            config.api_key = anthropic_key
        elif openai_key and len(openai_key) > 10:
            config.provider = "openai"
            config.model = db_settings.get("openai_model") or "gpt-4o-mini"
            config.api_key = openai_key
        elif db_settings.get("active_provider") and db_settings.get("active_provider") != "antigravity":
            p = db_settings["active_provider"]
            config.provider = p
            config.model = db_settings.get(f"{p}_model") or config.model
            config.api_key = db_settings.get(f"{p}_api_key")
        else:
            config.provider = "antigravity"
            config.model = "flash"
    else:
        config.provider = requested_provider.lower()

    # Environment variable / DB model override
    model_override = os.getenv("RUXT_VISION_MODEL") or os.getenv("AI_MODEL")
    if model_override:
        config.model = model_override
    elif config.provider == "gemini" and (not config.model or config.model in ["flash", "gemini-2.0-flash"]):
        config.model = "gemini-3.5-flash"

    base_url = os.getenv("RUXT_VISION_BASE_URL") or os.getenv("AI_BASE_URL")
    if base_url:
        config.base_url = base_url

    # Resolve API Key for chosen provider if not already set
    if not config.api_key:
        if config.provider == "gemini":
            config.api_key = db_settings.get("gemini_api_key") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        elif config.provider == "anthropic":
            config.api_key = db_settings.get("anthropic_api_key") or os.getenv("ANTHROPIC_API_KEY")
        elif config.provider == "openai":
            config.api_key = db_settings.get("openai_api_key") or os.getenv("OPENAI_API_KEY")
        elif config.provider == "openrouter":
            config.api_key = db_settings.get("openrouter_api_key") or os.getenv("OPENROUTER_API_KEY")
        
        if not config.api_key:
            config.api_key = os.getenv("RUXT_AI_KEY")

    # Local Ollama default URL
    if config.provider in ["ollama", "ui-tars"] and not config.base_url:
        config.base_url = os.getenv("OLLAMA_HOST", "http://localhost:11434/v1")
        if not config.api_key:
            config.api_key = "ollama"

    return config
