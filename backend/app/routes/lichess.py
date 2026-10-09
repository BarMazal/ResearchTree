from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.services.lichess_service import lichess_service
from app.schemas.event import EventRead

router = APIRouter(prefix="/lichess", tags=["lichess"])


class ImportLichessGameRequest(BaseModel):
    profile_id: str
    username: str
    max_games: int = 5


@router.get("/user/{username}/games")
def explore_user_games(username: str, max_games: int = Query(10, ge=1, le=50)):
    """
    Live exploration of a Lichess user's games.
    """
    games = lichess_service.fetch_user_games(username, max_games=max_games)
    return {"username": username, "count": len(games), "games": games}


@router.get("/puzzle/{puzzle_id}")
def explore_puzzle(puzzle_id: str):
    """
    Live exploration of a Lichess puzzle.
    """
    puzzle = lichess_service.fetch_puzzle(puzzle_id)
    if not puzzle:
        raise HTTPException(status_code=404, detail="Lichess puzzle not found")
    return puzzle


@router.post("/import", response_model=list[EventRead], status_code=201)
def import_user_games(body: ImportLichessGameRequest, db: Session = Depends(get_db)):
    """
    Imports recent Lichess games for a username directly into a profile's Event DAG database.
    """
    games = lichess_service.fetch_user_games(body.username, max_games=body.max_games)
    if not games:
        raise HTTPException(status_code=404, detail=f"No games found for user {body.username} on Lichess")

    events = []
    for game in games:
        evt = lichess_service.import_game_to_event(db, body.profile_id, game)
        events.append(evt)

    return events
