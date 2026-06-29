import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemEdge(Base):
    __tablename__ = "item_edges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source_item_id: Mapped[str] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    target_item_id: Mapped[str] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    relationship: Mapped[str] = mapped_column(String(50), nullable=False, default="reference")
    label: Mapped[str | None] = mapped_column(String(500), nullable=True)
