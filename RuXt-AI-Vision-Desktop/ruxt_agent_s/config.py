import os
from pathlib import Path
from typing import Any, Dict, Optional
import yaml
from pydantic import BaseModel, Field

class GroundingConfig(BaseModel):
    use_uia_tree: bool = True
    coordinate_scale: int = 1000
    screenshot_max_width: int = 1920
    screenshot_max_height: int = 1080

class ExecutionConfig(BaseModel):
    mouse_move_duration: float = 0.25
    action_delay: float = 0.5
    type_via_clipboard: bool = True
    failsafe: bool = True

class AgentConfig(BaseModel):
    max_steps: int = 25
    enable_reflection: bool = True
    log_level: str = "INFO"
    data_dir: str = "data"

class AppConfig(BaseModel):
    provider: str = "antigravity"
    model: str = "flash"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    grounding: GroundingConfig = Field(default_factory=GroundingConfig)
    execution: ExecutionConfig = Field(default_factory=ExecutionConfig)
    agent: AgentConfig = Field(default_factory=AgentConfig)

def load_config(config_path: Optional[str] = None) -> AppConfig:
    """Loads configuration from YAML and environment variables."""
    root_dir = Path(__file__).resolve().parent.parent
    cfg_file = Path(config_path) if config_path else root_dir / "config.yaml"
    
    data: Dict[str, Any] = {}
    if cfg_file.exists():
        with open(cfg_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}

    config = AppConfig(**data)

    # Environment variable overrides
    provider = os.getenv("RUXT_VISION_PROVIDER") or os.getenv("AI_PROVIDER")
    if provider:
        config.provider = provider.lower()

    model = os.getenv("RUXT_VISION_MODEL") or os.getenv("AI_MODEL")
    if model:
        config.model = model

    base_url = os.getenv("RUXT_VISION_BASE_URL") or os.getenv("AI_BASE_URL")
    if base_url:
        config.base_url = base_url

    # Check provider-specific API keys
    if not config.api_key:
        if config.provider == "openai":
            config.api_key = os.getenv("OPENAI_API_KEY")
        elif config.provider == "anthropic":
            config.api_key = os.getenv("ANTHROPIC_API_KEY")
        elif config.provider == "gemini":
            config.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        elif config.provider == "openrouter":
            config.api_key = os.getenv("OPENROUTER_API_KEY")
        
        # Generic fallback
        if not config.api_key:
            config.api_key = os.getenv("RUXT_AI_KEY")

    # Local Ollama default URL
    if config.provider == "ollama" and not config.base_url:
        config.base_url = os.getenv("OLLAMA_HOST", "http://localhost:11434/v1")
        if not config.api_key:
            config.api_key = "ollama"

    return config
