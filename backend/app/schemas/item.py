from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ItemCreate(BaseModel):
    title: str = Field(..., max_length=500)
    type: str = Field(default="note", max_length=50)
    file_path: str | None = None
    source_url: str | None = None
    summary: str | None = None
    progress: int = 0
    opacity: float = 1.0
    graph_x: float | None = None
    graph_y: float | None = None
    parent_item_id: str | None = None
    tag_ids: list[str] = []
    flags: list[str] = []
    is_local: bool = False
    is_resolved: bool = False
    blocker_reason: str | None = None
    resolution_note: str | None = None


class ItemUpdate(BaseModel):
    title: str | None = None
    type: str | None = None
    file_path: str | None = None
    source_url: str | None = None
    summary: str | None = None
    progress: int | None = None
    opacity: float | None = None
    graph_x: float | None = None
    graph_y: float | None = None
    parent_item_id: str | None = None
    tag_ids: list[str] | None = None
    flags: list[str] | None = None
    is_local: bool | None = None
    is_resolved: bool | None = None
    blocker_reason: str | None = None
    resolution_note: str | None = None
    last_accessed_at: datetime | None = None


class ItemRead(BaseModel):
    id: str
    title: str
    type: str
    file_path: str | None
    source_url: str | None
    summary: str | None
    progress: int
    opacity: float = 1.0
    graph_x: float | None
    graph_y: float | None
    parent_item_id: str | None
    is_archived: bool = False
    merged_into_id: str | None = None
    flags: list[str] = []
    is_local: bool = False
    is_resolved: bool = False
    blocker_reason: str | None = None
    resolution_note: str | None = None
    last_accessed_at: datetime | None = None
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    @field_validator("flags", mode="before")
    @classmethod
    def normalize_flags(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            try:
                import json
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(x) for x in parsed]
            except Exception:
                return []
        if isinstance(value, list):
            return [str(x) for x in value]
        return []

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value):
        if value is None:
            return []
        normalized: list[str] = []
        for tag in value:
            if isinstance(tag, str):
                normalized.append(tag)
            else:
                name = getattr(tag, "name", None)
                if isinstance(name, str):
                    normalized.append(name)
        return normalized

    model_config = {"from_attributes": True}

