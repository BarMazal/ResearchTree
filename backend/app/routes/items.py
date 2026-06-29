import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Item, Tag
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/items", tags=["items"])


@router.get("", response_model=list[ItemRead])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).order_by(Item.updated_at.desc()).all()


@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: str, db: Session = Depends(get_db)):
    return get_or_404(db, Item, item_id)


@router.post("", response_model=ItemRead, status_code=201)
def create_item(body: ItemCreate, db: Session = Depends(get_db)):
    tag_ids = body.tag_ids or []
    data = body.model_dump(exclude={"tag_ids"})
    item = Item(**data)
    if tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        item.tags = tags
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=ItemRead)
def update_item(item_id: str, body: ItemUpdate, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, item_id)
    data = body.model_dump(exclude={"tag_ids"}, exclude_none=True)
    for key, val in data.items():
        setattr(item, key, val)
    if body.tag_ids is not None:
        tags = db.query(Tag).filter(Tag.id.in_(body.tag_ids)).all() if body.tag_ids else []
        item.tags = tags
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, item_id)
    db.delete(item)
    db.commit()


@router.get("/{item_id}/file")
def get_item_file(item_id: str, db: Session = Depends(get_db)):
    item = get_or_404(db, Item, item_id)
    if not item.file_path:
        return {"error": "No file associated with this item"}
    path = Path(item.file_path)
    if not path.exists():
        return {"error": "File not found on disk"}
    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(str(path), media_type=media_type, headers={"Content-Disposition": "inline"})
