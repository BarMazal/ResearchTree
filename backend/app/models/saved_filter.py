from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.database import Base


class SavedFilter(Base):
    __tablename__ = "saved_filters"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    filter_config = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="saved_filters")
