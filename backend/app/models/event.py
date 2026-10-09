from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float
from sqlalchemy.orm import relationship

from app.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    event_class = Column(String, nullable=False, default="Game")  # "Game", "Riddle", "Exercise"
    category = Column(String, nullable=True)  # e.g., "openings", "endgames", "mate_in_K"
    goal_type = Column(String, nullable=False, default="win_game")  # win_game, mate_in_K, etc.
    goal_description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="running")  # running, done, failed
    player_white = Column(String, nullable=True)
    player_black = Column(String, nullable=True)
    opponent_name = Column(String, nullable=True)
    opponent_type = Column(String, nullable=False, default="human")  # "human", "bot"
    opponent_elo = Column(Integer, nullable=True, default=1500)
    player_elo_before = Column(Integer, nullable=True, default=1500)
    player_elo_after = Column(Integer, nullable=True, default=1500)
    result_score = Column(Float, nullable=True, default=1.0)  # 1.0 = win, 0.5 = draw, 0.0 = loss
    initial_fen = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="events")
    nodes = relationship("DAGNode", back_populates="event", cascade="all, delete-orphan")
