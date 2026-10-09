from datetime import datetime
from pydantic import BaseModel, Field


class SavedFilterCreate(BaseModel):
    profile_id: str
    name: str = Field(..., max_length=200)
    filter_config: dict


class SavedFilterRead(BaseModel):
    id: str
    profile_id: str
    name: str
    filter_config: dict
    created_at: datetime

    model_config = {"from_attributes": True}
