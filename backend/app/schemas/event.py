from datetime import datetime
from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    profile_id: str
    event_class: str = Field(default="Game")  # Game, Riddle, Exercise
    category: str | None = None
    goal_type: str = Field(default="win_game")
    goal_description: str | None = None
    player_white: str | None = None
    player_black: str | None = None
    initial_fen: str | None = None


class EventUpdate(BaseModel):
    event_class: str | None = None
    category: str | None = None
    goal_type: str | None = None
    goal_description: str | None = None
    status: str | None = None  # running, done, failed
    player_white: str | None = None
    player_black: str | None = None
    initial_fen: str | None = None


class EventRead(BaseModel):
    id: str
    profile_id: str
    event_class: str
    category: str | None = None
    goal_type: str
    goal_description: str | None = None
    status: str
    player_white: str | None = None
    player_black: str | None = None
    initial_fen: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
