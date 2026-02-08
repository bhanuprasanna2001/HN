"""Application configuration loaded from environment variables."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the SupportMind backend."""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_model_heavy: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # Paths
    data_path: str = str(
        Path(__file__).resolve().parent.parent.parent / "data" / "SupportMind__Final_Data.xlsx"
    )
    chroma_persist_dir: str = str(
        Path(__file__).resolve().parent.parent / "chroma_db"
    )

    # RAG
    retrieval_top_k: int = 5
    similarity_threshold: float = 0.35

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
