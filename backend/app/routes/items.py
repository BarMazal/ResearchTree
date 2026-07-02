import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Item, Tag
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/items", tags=["items"])


@router.get("")
def list_items(db: Session = Depends(get_db)):
    try:
        items = (
            db.query(Item)
            .options(selectinload(Item.tags))
            .order_by(Item.updated_at.desc())
            .all()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"list_items query failed: {exc}") from exc

    payload = []
    for item in items:
        try:
            tags = [getattr(tag, "name", str(tag)) for tag in (item.tags or [])]
        except Exception:
            tags = []

        payload.append(
            {
                "id": item.id,
                "title": item.title,
                "type": item.type,
                "file_path": item.file_path,
                "source_url": item.source_url,
                "summary": item.summary,
                "progress": item.progress,
                "graph_x": item.graph_x,
                "graph_y": item.graph_y,
                "parent_item_id": item.parent_item_id,
                "tags": tags,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            }
        )

    return payload


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
def delete_item(
    item_id: str,
    mode: str = Query("single", pattern="^(single|subtree)$"),
    db: Session = Depends(get_db),
):
    item = db.get(Item, item_id)
    if item is None:
        return

    if mode == "single":
        direct_children = db.query(Item).filter(Item.parent_item_id == item_id).all()
        for child in direct_children:
            child.parent_item_id = None
        db.delete(item)
        db.commit()
        return

    all_items = db.query(Item.id, Item.parent_item_id).all()
    children_map: dict[str, list[str]] = {}
    for row in all_items:
        if row.parent_item_id:
            children_map.setdefault(row.parent_item_id, []).append(row.id)

    postorder_ids: list[str] = []

    def collect_postorder(current_id: str):
        for child_id in children_map.get(current_id, []):
            collect_postorder(child_id)
        postorder_ids.append(current_id)

    collect_postorder(item_id)
    items_by_id = {
        obj.id: obj for obj in db.query(Item).filter(Item.id.in_(postorder_ids)).all()
    }
    for current_id in postorder_ids:
        obj = items_by_id.get(current_id)
        if obj is not None:
            db.delete(obj)
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
