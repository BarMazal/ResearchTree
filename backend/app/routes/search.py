from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Item
from app.schemas.item import ItemRead

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/items", response_model=list[ItemRead])
def search_items(q: str = Query("", min_length=1), db: Session = Depends(get_db)):
    pattern = f"%{q}%"
    return (
        db.query(Item)
        .filter(
            or_(
                Item.title.ilike(pattern),
                Item.summary.ilike(pattern),
            )
        )
        .order_by(Item.updated_at.desc())
        .all()
    )
