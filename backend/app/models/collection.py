from pydantic import BaseModel


class CollectionInfo(BaseModel):
    name: str
    is_active: bool = False
    item_count: int = 0
    file_count: int = 0
    size_bytes: int = 0
    created_at: str | None = None


class CollectionCreateRequest(BaseModel):
    name: str


class CollectionSwitchRequest(BaseModel):
    name: str


class CopySubtreeRequest(BaseModel):
    item_id: str
    target_collection: str
