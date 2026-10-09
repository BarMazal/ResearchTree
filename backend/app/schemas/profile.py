from datetime import datetime
from pydantic import BaseModel, Field


class ProfileCreate(BaseModel):
    username: str = Field(..., max_length=100)
    display_name: str | None = None
    is_qa: bool = False


class ProfileUpdate(BaseModel):
    username: str | None = None
    display_name: str | None = None
    is_qa: bool | None = None


class ProfileRead(BaseModel):
    id: str
    username: str
    display_name: str | None = None
    is_qa: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
