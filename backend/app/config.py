"""Application configuration loaded from environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Search for .env in project root first, then backend dir
_ENV_FILE = str(_PROJECT_ROOT / ".env") if (_PROJECT_ROOT / ".env").exists() else str(_BACKEND_ROOT / ".env")


class Settings(BaseSettings):
    """Central configuration for the Speare AI backend."""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_model_heavy: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # Paths
    data_path: str = str(_PROJECT_ROOT / "data" / "SupportMind__Final_Data.xlsx")
    chroma_persist_dir: str = str(_BACKEND_ROOT / "chroma_db")

    # RAG
    retrieval_top_k: int = 5
    similarity_threshold: float = 0.35

    class Config:
        env_file = _ENV_FILE
        env_file_encoding = "utf-8"
        extra = "ignore"


def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
