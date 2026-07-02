from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tag
from app.schemas.tag import TagCreate, TagRead
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(func.lower(Tag.name), Tag.name).all()


@router.post("", response_model=TagRead, status_code=201)
def create_tag(body: TagCreate, db: Session = Depends(get_db)):
    normalized_name = body.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Tag name cannot be empty")

    tag = db.query(Tag).filter(func.lower(Tag.name) == normalized_name.lower()).first()
    if tag:
        return tag
    tag = Tag(name=normalized_name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: str, db: Session = Depends(get_db)):
    tag = get_or_404(db, Tag, tag_id)
    db.delete(tag)
    db.commit()
