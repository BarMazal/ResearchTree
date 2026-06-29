from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    name: str = Field(..., max_length=100)


class TagRead(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}
