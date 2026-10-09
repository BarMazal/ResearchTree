from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer, Float, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class DAGNode(Base):
    __tablename__ = "dag_nodes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event_id = Column(String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    profile_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(String, ForeignKey("dag_nodes.id", ondelete="SET NULL"), nullable=True, index=True)
    
    move_san = Column(String, nullable=True)
    move_uci = Column(String, nullable=True)
    fen = Column(Text, nullable=False)
    move_index = Column(Integer, nullable=False, default=0)
    
    is_leaf = Column(Boolean, default=True, nullable=False)
    leaf_termination = Column(String, nullable=True)  # NULL, abandoned_undo, restart_fail, game_won, riddle_solved
    
    clock_remaining_sec = Column(Float, nullable=True)
    move_time_sec = Column(Float, nullable=True)
    
    blunder_count_so_far = Column(Integer, default=0, nullable=False)
    missed_opportunity_count_so_far = Column(Integer, default=0, nullable=False)
    blunder_frequency = Column(Float, default=0.0, nullable=False)
    missed_opportunity_frequency = Column(Float, default=0.0, nullable=False)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    event = relationship("Event", back_populates="nodes")
    parent = relationship("DAGNode", remote_side=[id], backref="children")
    analysis = relationship("NodeAnalysis", back_populates="node", uselist=False, cascade="all, delete-orphan")
