from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship

from app.database import Base


class NodeAnalysis(Base):
    __tablename__ = "node_analysis"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id = Column(String, ForeignKey("dag_nodes.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    status = Column(String, nullable=False, default="pending")  # pending, analyzing, completed, failed
    stockfish_eval = Column(Float, nullable=True)
    eval_delta = Column(Float, nullable=True)
    
    category_class = Column(String, nullable=True)  # fork_double_attack, pin_skewer, etc.
    sub_category = Column(String, nullable=True)    # knight_fork, unprotected_piece, etc.
    quality_score = Column(Float, nullable=True)    # 0.0 to 1.0
    reasoning = Column(Text, nullable=True)
    
    # 6-Aspect Metric Funnel
    opportunity_created = Column(Boolean, default=False, nullable=False)
    opportunity_executed = Column(Boolean, default=False, nullable=False)
    material_yield = Column(Float, default=0.0, nullable=False)
    
    opponent_threat_created = Column(Boolean, default=False, nullable=False)
    defensive_failure = Column(Boolean, default=False, nullable=False)
    material_damage = Column(Float, default=0.0, nullable=False)
    
    phase = Column(String, nullable=True)  # opening, middlegame, endgame
    analyzed_at = Column(DateTime, nullable=True)

    node = relationship("DAGNode", back_populates="analysis")
