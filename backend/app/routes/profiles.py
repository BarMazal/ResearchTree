from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.profile import Profile
from app.models.event import Event
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


@router.get("/{profile_id}/analytics/elo-history")
def get_profile_elo_history(profile_id: str, db: Session = Depends(get_db)):
    profile = get_or_404(db, Profile, profile_id)
    events = (
        db.query(Event)
        .filter(Event.profile_id == profile.id)
        .order_by(Event.created_at.asc())
        .all()
    )

    history = []
    wins = 0
    draws = 0
    losses = 0
    total_games = 0

    for idx, evt in enumerate(events, start=1):
        score = evt.result_score if evt.result_score is not None else 1.0
        total_games += 1
        if score >= 0.9:
            wins += 1
        elif score >= 0.4:
            draws += 1
        else:
            losses += 1

        win_rate = round((wins / total_games) * 100.0, 1) if total_games > 0 else 0.0

        history.append({
            "event_id": evt.id,
            "event_number": idx,
            "created_at": evt.created_at.isoformat() if evt.created_at else None,
            "event_class": evt.event_class,
            "category": evt.category,
            "opponent_name": evt.opponent_name or ("Bot Opponent" if evt.opponent_type == "bot" else "Human Opponent"),
            "opponent_type": evt.opponent_type or "human",
            "opponent_elo": evt.opponent_elo or 1500,
            "player_elo_before": evt.player_elo_before or 1500,
            "player_elo_after": evt.player_elo_after or 1500,
            "result_score": score,
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "win_rate": win_rate,
        })

    return {
        "profile_id": profile.id,
        "username": profile.username,
        "total_events": len(events),
        "current_elo": history[-1]["player_elo_after"] if history else 1500,
        "overall_win_rate": history[-1]["win_rate"] if history else 0.0,
        "history": history,
    }


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
