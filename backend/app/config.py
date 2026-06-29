from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{Path(__file__).parent.parent / 'research_tree.db'}"
    storage_dir: Path = Path.home() / "ResearchTree" / "files"

    model_config = {"env_prefix": "RT_", "env_file": ".env"}


settings = Settings()
