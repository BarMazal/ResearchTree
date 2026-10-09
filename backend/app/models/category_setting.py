from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class CategorySetting(Base):
    __tablename__ = "category_settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    profile_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    category_key = Column(String, nullable=False)
    is_custom = Column(Boolean, default=False, nullable=False)
    status = Column(String, nullable=False, default="canonical")  # canonical, promoted, demoted, custom_pending
    occurrence_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="category_settings")
