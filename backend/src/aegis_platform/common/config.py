"""Runtime configuration (env-driven, validated at startup)."""

from __future__ import annotations

from enum import Enum

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Autonomy(str, Enum):
    SHADOW = "shadow"      # observe + recommend, never act
    GUARDED = "guarded"    # auto-apply L0/L1, require approval for L2
    AUTO = "auto"          # auto-apply through L1 (L2 still always gated)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="", env_file=".env", extra="ignore", frozen=True
    )

    # Google Cloud
    google_cloud_project: str = Field(default="", alias="GOOGLE_CLOUD_PROJECT")
    google_cloud_region: str = Field(default="asia-northeast1", alias="GOOGLE_CLOUD_REGION")
    use_vertexai: bool = Field(default=True, alias="GOOGLE_GENAI_USE_VERTEXAI")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")

    # Models (pin versions for deterministic demos)
    model_deep: str = Field(default="gemini-2.5-pro", alias="AEGIS_MODEL_DEEP")
    model_fast: str = Field(default="gemini-2.5-flash", alias="AEGIS_MODEL_FAST")
    model_cheap: str = Field(default="gemma-3", alias="AEGIS_MODEL_CHEAP")

    # Aegis runtime
    env: str = Field(default="local", alias="AEGIS_ENV")
    demo_mode: bool = Field(default=True, alias="AEGIS_DEMO_MODE")
    loop_max_steps: int = Field(default=12, alias="AEGIS_LOOP_MAX_STEPS")
    autonomy: Autonomy = Field(default=Autonomy.GUARDED, alias="AEGIS_AUTONOMY")

    # CORS — comma-separated allowed origins for the dashboard (no wildcard in prod).
    allowed_origins: str = Field(default="http://localhost:3000", alias="AEGIS_ALLOWED_ORIGINS")

    # Stores / integrations (optional; empty → in-memory fallbacks)
    bigquery_dataset: str = Field(default="aegis", alias="BIGQUERY_DATASET")
    elasticsearch_url: str = Field(default="", alias="ELASTICSEARCH_URL")
    elasticsearch_api_key: str = Field(default="", alias="ELASTICSEARCH_API_KEY")
    github_repo: str = Field(default="", alias="GITHUB_REPO")
    slack_webhook_url: str = Field(default="", alias="SLACK_WEBHOOK_URL")


_settings: Settings | None = None


def get_settings() -> Settings:
    """Process-wide settings singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
