from datetime import datetime
from pydantic import BaseModel, Field


class CategorySettingCreate(BaseModel):
    profile_id: str
    category_key: str
    is_custom: bool = False
    status: str = "canonical"


class CategorySettingUpdate(BaseModel):
    status: str  # canonical, promoted, demoted, custom_pending


class CategorySettingRead(BaseModel):
    id: str
    profile_id: str
    category_key: str
    is_custom: bool
    status: str
    occurrence_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
