from datetime import datetime

from pydantic import BaseModel


class BookmarkCreate(BaseModel):
    item_id: str
    page: int | None = None
    chapter: str | None = None
    quote: str | None = None
    note: str | None = None
    spawned_item_id: str | None = None


class BookmarkRead(BaseModel):
    id: str
    item_id: str
    page: int | None
    chapter: str | None
    quote: str | None
    note: str | None
    spawned_item_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
