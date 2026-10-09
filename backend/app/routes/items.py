import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session, selectinload

from pydantic import BaseModel, Field
from sqlalchemy import or_
from app.database import get_db
from app.models import Bookmark, Item, ItemEdge, Tag
from app.schemas.item import ItemCreate, ItemRead, ItemUpdate
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/items", tags=["items"])


class MergeItemsRequest(BaseModel):
    primary_id: str
    secondary_ids: list[str]


@router.get("")
def list_items(db: Session = Depends(get_db)):
    try:
        items = (
            db.query(Item)
            .filter(Item.is_archived.isnot(True))
            .options(selectinload(Item.tags))
            .order_by(Item.updated_at.desc())
            .all()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"list_items query failed: {exc}") from exc


    payload = []
    import json
    for item in items:
        try:
            tags = [getattr(tag, "name", str(tag)) for tag in (item.tags or [])]
        except Exception:
            tags = []

        flags_val = []
        if item.flags:
            if isinstance(item.flags, list):
                flags_val = item.flags
            elif isinstance(item.flags, str):
                try:
                    parsed = json.loads(item.flags)
                    if isinstance(parsed, list):
                        flags_val = parsed
                except Exception:
                    flags_val = []

        payload.append(
            {
                "id": item.id,
                "title": item.title,
                "type": item.type,
                "file_path": item.file_path,
                "source_url": item.source_url,
                "summary": item.summary,
                "progress": item.progress,
                "opacity": getattr(item, "opacity", 1.0) if getattr(item, "opacity", 1.0) is not None else 1.0,
                "graph_x": item.graph_x,
                "graph_y": item.graph_y,
                "parent_item_id": item.parent_item_id,
                "is_archived": item.is_archived,
                "merged_into_id": item.merged_into_id,
                "flags": flags_val,
                "is_local": bool(item.is_local),
                "is_resolved": bool(item.is_resolved),
                "blocker_reason": item.blocker_reason,
                "resolution_note": item.resolution_note,
                "last_accessed_at": item.last_accessed_at,
                "tags": tags,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            }
        )

    return payload


@router.post("/merge", response_model=ItemRead)
def merge_items(req: MergeItemsRequest, db: Session = Depends(get_db)):
    primary = get_or_404(db, Item, req.primary_id)
    if not req.secondary_ids:
        return primary

    secondaries = db.query(Item).filter(Item.id.in_(req.secondary_ids)).all()

    for sec in secondaries:
        if sec.id == primary.id:
            continue

        # Preserve secondary item's parent relationship as an ItemEdge to primary
        sec_parent_id = sec.parent_item_id
        if sec_parent_id and sec_parent_id != primary.id:
            if not primary.parent_item_id:
                primary.parent_item_id = sec_parent_id
            elif sec_parent_id != primary.parent_item_id:
                existing_edge = db.query(ItemEdge).filter(
                    ItemEdge.source_item_id == sec_parent_id,
                    ItemEdge.target_item_id == primary.id,
                ).first()
                if not existing_edge:
                    edge = ItemEdge(
                        source_item_id=sec_parent_id,
                        target_item_id=primary.id,
                        relationship="parent_child",
                        label=None,
                    )
                    db.add(edge)

        # Re-parent direct child items
        db.query(Item).filter(Item.parent_item_id == sec.id).update(
            {"parent_item_id": primary.id}, synchronize_session=False
        )

        # Re-link bookmarks
        db.query(Bookmark).filter(Bookmark.item_id == sec.id).update(
            {"item_id": primary.id}, synchronize_session=False
        )
        db.query(Bookmark).filter(Bookmark.spawned_item_id == sec.id).update(
            {"spawned_item_id": primary.id}, synchronize_session=False
        )

        # Re-link item graph edges
        db.query(ItemEdge).filter(ItemEdge.source_item_id == sec.id).update(
            {"source_item_id": primary.id}, synchronize_session=False
        )
        db.query(ItemEdge).filter(ItemEdge.target_item_id == sec.id).update(
            {"target_item_id": primary.id}, synchronize_session=False
        )

        # Transfer tags
        for tag in sec.tags:
            if tag not in primary.tags:
                primary.tags.append(tag)

        # Append notes & summary content if non-empty
        if sec.summary and sec.summary.strip():
            sep = "\n\n" if primary.summary else ""
            primary.summary = (primary.summary or "") + f"{sep}--- Merged Note from \"{sec.title}\" ---\n" + sec.summary.strip()

        # Mark secondary item as archived
        sec.is_archived = True
        sec.merged_into_id = primary.id


    # Cleanup any self-referencing loops created by merge
    db.query(ItemEdge).filter(
        ItemEdge.source_item_id == primary.id,
        ItemEdge.target_item_id == primary.id,
    ).delete(synchronize_session=False)

    db.commit()
    db.refresh(primary)
    return primary



@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: str, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    item = get_or_404(db, Item, item_id)
    item.last_accessed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)
    return item


@router.post("", response_model=ItemRead, status_code=201)
def create_item(body: ItemCreate, db: Session = Depends(get_db)):
    import json
    from datetime import datetime, timezone
    tag_ids = body.tag_ids or []
    data = body.model_dump(exclude={"tag_ids", "flags"})
    data["flags"] = json.dumps(body.flags or [])
    data["last_accessed_at"] = datetime.now(timezone.utc)
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
    import json
    from datetime import datetime, timezone
    item = get_or_404(db, Item, item_id)
    data = body.model_dump(exclude={"tag_ids"}, exclude_none=True)
    if "flags" in data and data["flags"] is not None:
        data["flags"] = json.dumps(data["flags"])
    data["last_accessed_at"] = datetime.now(timezone.utc)
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
        db.query(Bookmark).filter(Bookmark.spawned_item_id == item_id).delete(synchronize_session=False)
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
    db.query(Bookmark).filter(Bookmark.spawned_item_id.in_(postorder_ids)).delete(synchronize_session=False)
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
    url_or_path = item.file_path or item.source_url
    if not url_or_path:
        raise HTTPException(status_code=404, detail="No file or source URL associated with this item")

    # 1. Local file path check
    if not (url_or_path.startswith("http://") or url_or_path.startswith("https://")):
        path = Path(url_or_path)
        if not (path.exists() and path.is_file()):
            try:
                from app.services.collection_service import collection_service
                alt = collection_service.get_active_files_dir() / path.name
                if alt.exists() and alt.is_file():
                    path = alt
            except Exception:
                pass
        if path.exists() and path.is_file():
            media_type, _ = mimetypes.guess_type(str(path))
            return FileResponse(str(path), media_type=media_type or "application/pdf", headers={"Content-Disposition": "inline"})
        raise HTTPException(status_code=404, detail=f"File not found on disk: {url_or_path}")

    # 2. Remote URL check (HTTP / HTTPS)
    target_url = url_or_path
    if "arxiv.org/abs/" in target_url:
        target_url = target_url.replace("arxiv.org/abs/", "arxiv.org/pdf/")
    if "arxiv.org/pdf/" in target_url and not target_url.endswith(".pdf"):
        target_url += ".pdf"

    try:
        import ssl
        import urllib.request
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            target_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            content = resp.read()
            content_type = resp.headers.get("Content-Type", "application/pdf")
            return Response(content=content, media_type=content_type, headers={"Content-Disposition": "inline"})
    except Exception as err:
        raise HTTPException(status_code=502, detail=f"Failed to fetch remote file from {target_url}: {err}") from err

