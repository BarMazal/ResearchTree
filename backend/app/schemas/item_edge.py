from pydantic import BaseModel, Field


class ItemEdgeCreate(BaseModel):
    source_item_id: str
    target_item_id: str
    relationship: str = Field(default="reference", max_length=50)
    label: str | None = None


class ItemEdgeRead(BaseModel):
    id: str
    source_item_id: str
    target_item_id: str
    relationship: str
    label: str | None

    model_config = {"from_attributes": True}
