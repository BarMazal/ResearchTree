from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Item, Tag
from app.schemas.item import ItemRead

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/items", response_model=list[ItemRead])
def search_items(
    q: str = Query(""),
    tags: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
):
    query = db.query(Item).options(selectinload(Item.tags))

    selected_tags = [t.strip() for t in tags if t and t.strip()]
    for tag_name in selected_tags:
        query = query.filter(Item.tags.any(func.lower(Tag.name) == tag_name.lower()))

    terms = [term.strip() for term in q.split() if term.strip()]
    for term in terms:
        pattern = f"%{term}%"
        query = query.filter(
            or_(
                Item.title.ilike(pattern),
                Item.summary.ilike(pattern),
                Item.source_url.ilike(pattern),
                Item.file_path.ilike(pattern),
                Item.type.ilike(pattern),
                Item.tags.any(Tag.name.ilike(pattern)),
            )
        )

    return query.order_by(Item.updated_at.desc()).all()
