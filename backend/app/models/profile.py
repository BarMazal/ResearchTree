from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.orm import relationship

from app.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, nullable=False, unique=True, index=True)
    display_name = Column(String, nullable=True)
    is_qa = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    events = relationship("Event", back_populates="profile", cascade="all, delete-orphan")
    saved_filters = relationship("SavedFilter", back_populates="profile", cascade="all, delete-orphan")
    category_settings = relationship("CategorySetting", back_populates="profile", cascade="all, delete-orphan")
