from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Bookmark
from app.schemas.bookmark import BookmarkCreate, BookmarkRead
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("/item/{item_id}", response_model=list[BookmarkRead])
def list_bookmarks(item_id: str, db: Session = Depends(get_db)):
    return db.query(Bookmark).filter(Bookmark.item_id == item_id).order_by(Bookmark.created_at.desc()).all()


@router.post("", response_model=BookmarkRead, status_code=201)
def create_bookmark(body: BookmarkCreate, db: Session = Depends(get_db)):
    bookmark = Bookmark(**body.model_dump())
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.delete("/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: str, db: Session = Depends(get_db)):
    bookmark = get_or_404(db, Bookmark, bookmark_id)
    db.delete(bookmark)
    db.commit()
