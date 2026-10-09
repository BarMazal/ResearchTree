from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{Path(__file__).parent.parent / 'research_tree.db'}"
    storage_dir: Path = Path.home() / "ResearchTree" / "files"

    llm_provider: str = "ollama"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:latest"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-sonnet"

    notebooklm_cookie: str | None = None

    model_config = {"env_prefix": "RT_", "env_file": ".env"}


settings = Settings()
