import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

item_tags = Table(
    "item_tags",
    Base.metadata,
    Column("item_id", ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Item(Base):
    __tablename__ = "items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="note")
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    opacity: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    graph_x: Mapped[float | None] = mapped_column(nullable=True)
    graph_y: Mapped[float | None] = mapped_column(nullable=True)
    parent_item_id: Mapped[str | None] = mapped_column(ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    merged_into_id: Mapped[str | None] = mapped_column(ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    flags: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    is_local: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocker_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    tags = relationship("Tag", secondary="item_tags", back_populates="items")
    bookmarks = relationship("Bookmark", back_populates="item", cascade="all, delete-orphan", foreign_keys="[Bookmark.item_id]")
    children = relationship("Item", back_populates="parent", foreign_keys="[Item.parent_item_id]")
    parent = relationship("Item", back_populates="children", remote_side=[id], foreign_keys="[Item.parent_item_id]")

