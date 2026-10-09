from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.saved_filter import SavedFilter
from app.schemas.saved_filter import SavedFilterCreate, SavedFilterRead
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/saved-filters", tags=["saved_filters"])


@router.get("", response_model=list[SavedFilterRead])
def list_saved_filters(profile_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(SavedFilter)
    if profile_id:
        query = query.filter(SavedFilter.profile_id == profile_id)
    return query.order_by(SavedFilter.created_at.desc()).all()


@router.post("", response_model=SavedFilterRead, status_code=201)
def create_saved_filter(body: SavedFilterCreate, db: Session = Depends(get_db)):
    saved = SavedFilter(**body.model_dump())
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


@router.get("/{filter_id}", response_model=SavedFilterRead)
def get_saved_filter(filter_id: str, db: Session = Depends(get_db)):
    return get_or_404(db, SavedFilter, filter_id)


@router.delete("/{filter_id}", status_code=204)
def delete_saved_filter(filter_id: str, db: Session = Depends(get_db)):
    saved = db.get(SavedFilter, filter_id)
    if saved:
        db.delete(saved)
        db.commit()
