from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.category_setting import CategorySetting
from app.schemas.category_setting import CategorySettingCreate, CategorySettingRead, CategorySettingUpdate
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/category-settings", tags=["category_settings"])

CANONICAL_CATEGORIES = [
    "fork_double_attack", "pin_skewer", "discovered_attack", "deflection_decoy",
    "remove_the_guard", "trapped_piece", "intermezzo_zwischenzug", "back_rank_vulnerability",
    "mating_net_attack", "passed_pawn_mechanics", "pawn_structure_weakness", "outpost_square_control",
    "open_file_control", "king_activity_opposition", "pawn_race", "battery", "x_ray",
    "gain_space", "open_lines", "develop_pieces", "king_safety", "piece_coordination",
    "overextension", "unprotected_piece", "simplify_on_advantage", "famous_openings"
]


@router.get("", response_model=list[CategorySettingRead])
def list_category_settings(profile_id: str, db: Session = Depends(get_db)):
    settings = db.query(CategorySetting).filter(CategorySetting.profile_id == profile_id).all()
    if not settings:
        # Auto-populate initial canonical category settings for profile
        for cat in CANONICAL_CATEGORIES:
            db.add(CategorySetting(
                profile_id=profile_id,
                category_key=cat,
                is_custom=False,
                status="canonical",
                occurrence_count=0
            ))
        db.commit()
        settings = db.query(CategorySetting).filter(CategorySetting.profile_id == profile_id).all()
    return settings


@router.post("", response_model=CategorySettingRead, status_code=201)
def create_category_setting(body: CategorySettingCreate, db: Session = Depends(get_db)):
    setting = CategorySetting(**body.model_dump())
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.put("/{setting_id}", response_model=CategorySettingRead)
def update_category_setting(setting_id: str, body: CategorySettingUpdate, db: Session = Depends(get_db)):
    setting = get_or_404(db, CategorySetting, setting_id)
    setting.status = body.status
    db.commit()
    db.refresh(setting)
    return setting


@router.delete("/{setting_id}", status_code=204)
def delete_category_setting(setting_id: str, db: Session = Depends(get_db)):
    setting = db.get(CategorySetting, setting_id)
    if setting:
        db.delete(setting)
        db.commit()
