from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.profile import Profile
from app.schemas.profile import ProfileCreate, ProfileRead, ProfileUpdate
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileRead])
def list_profiles(db: Session = Depends(get_db)):
    profiles = db.query(Profile).order_by(Profile.created_at.desc()).all()
    if not profiles:
        # Auto-create default user and QA profiles for immediate out-of-the-box usage
        default_user = Profile(username="default_player", display_name="Default Player", is_qa=False)
        qa_user = Profile(username="qa_tester", display_name="QA Tester Profile", is_qa=True)
        db.add(default_user)
        db.add(qa_user)
        db.commit()
        profiles = db.query(Profile).order_by(Profile.created_at.desc()).all()
    return profiles


@router.post("", response_model=ProfileRead, status_code=201)
def create_profile(body: ProfileCreate, db: Session = Depends(get_db)):
    existing = db.query(Profile).filter(Profile.username == body.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    profile = Profile(**body.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{profile_id}", response_model=ProfileRead)
def get_profile(profile_id: str, db: Session = Depends(get_db)):
    return get_or_404(db, Profile, profile_id)


@router.put("/{profile_id}", response_model=ProfileRead)
def update_profile(profile_id: str, body: ProfileUpdate, db: Session = Depends(get_db)):
    profile = get_or_404(db, Profile, profile_id)
    data = body.model_dump(exclude_none=True)
    for key, val in data.items():
        setattr(profile, key, val)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: str, db: Session = Depends(get_db)):
    profile = db.get(Profile, profile_id)
    if profile:
        db.delete(profile)
        db.commit()
