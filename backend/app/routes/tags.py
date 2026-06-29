from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Tag
from app.schemas.tag import TagCreate, TagRead
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
def list_tags(db: Session = Depends(get_db)):
    return db.query(Tag).order_by(Tag.name).all()


@router.post("", response_model=TagRead, status_code=201)
def create_tag(body: TagCreate, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.name == body.name).first()
    if tag:
        return tag
    tag = Tag(**body.model_dump())
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=204)
def delete_tag(tag_id: str, db: Session = Depends(get_db)):
    tag = get_or_404(db, Tag, tag_id)
    db.delete(tag)
    db.commit()
