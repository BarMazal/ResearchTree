from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.event import Event
from app.models.dag_node import DAGNode
from app.models.node_analysis import NodeAnalysis
from app.models.profile import Profile
from app.schemas.event import EventCreate, EventRead, EventUpdate
from app.schemas.dag_node import DAGNodeRead, MoveRecordCreate, UndoRequest
from app.services.db_helpers import get_or_404

router = APIRouter(prefix="/events", tags=["events"])

DEFAULT_INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"


@router.get("", response_model=list[EventRead])
def list_events(
    profile_id: str | None = None,
    event_class: str | None = None,
    category: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Event)
    if profile_id:
        query = query.filter(Event.profile_id == profile_id)
    if event_class:
        query = query.filter(Event.event_class == event_class)
    if category:
        query = query.filter(Event.category == category)
    if status:
        query = query.filter(Event.status == status)

    return query.order_by(Event.created_at.desc()).all()


@router.post("", response_model=EventRead, status_code=201)
def create_event(body: EventCreate, db: Session = Depends(get_db)):
    profile = db.get(Profile, body.profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    initial_fen = body.initial_fen or DEFAULT_INITIAL_FEN
    event = Event(**body.model_dump())
    event.initial_fen = initial_fen
    db.add(event)
    db.commit()
    db.refresh(event)

    # Create root DAGNode (move_index=0, no parent)
    root_node = DAGNode(
        event_id=event.id,
        profile_id=event.profile_id,
        parent_id=None,
        move_san=None,
        move_uci=None,
        fen=initial_fen,
        move_index=0,
        is_leaf=True,
        leaf_termination=None,
        blunder_count_so_far=0,
        missed_opportunity_count_so_far=0,
        blunder_frequency=0.0,
        missed_opportunity_frequency=0.0,
    )
    db.add(root_node)
    db.commit()

    return event


@router.get("/{event_id}", response_model=EventRead)
def get_event(event_id: str, db: Session = Depends(get_db)):
    return get_or_404(db, Event, event_id)


@router.put("/{event_id}", response_model=EventRead)
def update_event(event_id: str, body: EventUpdate, db: Session = Depends(get_db)):
    event = get_or_404(db, Event, event_id)
    data = body.model_dump(exclude_none=True)
    for key, val in data.items():
        setattr(event, key, val)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: str, db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if event:
        db.delete(event)
        db.commit()


@router.post("/{event_id}/moves", response_model=DAGNodeRead, status_code=201)
def record_move(event_id: str, body: MoveRecordCreate, db: Session = Depends(get_db)):
    event = get_or_404(db, Event, event_id)

    # Find active leaf node (where is_leaf=True and leaf_termination is None)
    active_leaf = (
        db.query(DAGNode)
        .filter(DAGNode.event_id == event_id, DAGNode.is_leaf == True, DAGNode.leaf_termination.is_(None))
        .order_by(DAGNode.created_at.desc())
        .first()
    )

    if not active_leaf:
        # Fallback to root or latest node
        active_leaf = (
            db.query(DAGNode)
            .filter(DAGNode.event_id == event_id)
            .order_by(DAGNode.move_index.desc())
            .first()
        )

    parent_id = active_leaf.id if active_leaf else None
    parent_move_index = active_leaf.move_index if active_leaf else 0
    new_move_index = parent_move_index + 1

    # Inherit cumulative blunder & miss counters from parent
    parent_blunders = active_leaf.blunder_count_so_far if active_leaf else 0
    parent_misses = active_leaf.missed_opportunity_count_so_far if active_leaf else 0

    blunder_freq = round(parent_blunders / new_move_index, 4) if new_move_index > 0 else 0.0
    miss_freq = round(parent_misses / new_move_index, 4) if new_move_index > 0 else 0.0

    if active_leaf:
        active_leaf.is_leaf = False

    new_node = DAGNode(
        event_id=event_id,
        profile_id=event.profile_id,
        parent_id=parent_id,
        move_san=body.move_san,
        move_uci=body.move_uci,
        fen=body.fen,
        move_index=new_move_index,
        is_leaf=True,
        leaf_termination=None,
        clock_remaining_sec=body.clock_remaining_sec,
        move_time_sec=body.move_time_sec,
        blunder_count_so_far=parent_blunders,
        missed_opportunity_count_so_far=parent_misses,
        blunder_frequency=blunder_freq,
        missed_opportunity_frequency=miss_freq,
    )
    db.add(new_node)
    db.commit()
    db.refresh(new_node)

    # Create un-analyzed NodeAnalysis record for async worker
    analysis = NodeAnalysis(
        node_id=new_node.id,
        status="pending",
        opportunity_created=False,
        opportunity_executed=False,
        material_yield=0.0,
        opponent_threat_created=False,
        defensive_failure=False,
        material_damage=0.0,
    )
    db.add(analysis)
    db.commit()
    db.refresh(new_node)

    return new_node


@router.post("/{event_id}/undo", response_model=DAGNodeRead)
def undo_move(event_id: str, body: UndoRequest = UndoRequest(), db: Session = Depends(get_db)):
    event = get_or_404(db, Event, event_id)

    active_leaf = (
        db.query(DAGNode)
        .filter(DAGNode.event_id == event_id, DAGNode.is_leaf == True, DAGNode.leaf_termination.is_(None))
        .order_by(DAGNode.created_at.desc())
        .first()
    )

    if not active_leaf or not active_leaf.parent_id:
        raise HTTPException(status_code=400, detail="Cannot undo: at root or no active attempt leaf")

    # Snapshot and flag current leaf as abandoned_undo
    active_leaf.leaf_termination = "abandoned_undo"

    # Target parent node becomes the active leaf for the next attempt
    target_node_id = body.target_node_id or active_leaf.parent_id
    target_node = get_or_404(db, DAGNode, target_node_id)
    target_node.is_leaf = True
    target_node.leaf_termination = None

    db.commit()
    db.refresh(target_node)
    return target_node


@router.post("/{event_id}/restart", response_model=DAGNodeRead)
def restart_event(event_id: str, db: Session = Depends(get_db)):
    event = get_or_404(db, Event, event_id)

    active_leaf = (
        db.query(DAGNode)
        .filter(DAGNode.event_id == event_id, DAGNode.is_leaf == True, DAGNode.leaf_termination.is_(None))
        .order_by(DAGNode.created_at.desc())
        .first()
    )

    if active_leaf:
        active_leaf.leaf_termination = "restart_fail"

    # Reset active leaf to root node (move_index=0)
    root_node = (
        db.query(DAGNode)
        .filter(DAGNode.event_id == event_id, DAGNode.move_index == 0)
        .first()
    )
    if not root_node:
        raise HTTPException(status_code=500, detail="Root node missing for event")

    root_node.is_leaf = True
    root_node.leaf_termination = None

    db.commit()
    db.refresh(root_node)
    return root_node


@router.get("/{event_id}/dag")
def get_event_dag(event_id: str, db: Session = Depends(get_db)):
    event = get_or_404(db, Event, event_id)

    nodes = (
        db.query(DAGNode)
        .options(selectinload(DAGNode.analysis))
        .filter(DAGNode.event_id == event_id)
        .order_by(DAGNode.move_index.asc(), DAGNode.created_at.asc())
        .all()
    )

    leaf_hash = {
        node.id: {
            "move_index": node.move_index,
            "termination": node.leaf_termination,
            "fen": node.fen,
            "blunder_frequency": node.blunder_frequency,
        }
        for node in nodes
        if node.is_leaf or node.leaf_termination is not None
    }

    return {
        "event": {
            "id": event.id,
            "profile_id": event.profile_id,
            "event_class": event.event_class,
            "category": event.category,
            "goal_type": event.goal_type,
            "goal_description": event.goal_description,
            "status": event.status,
            "player_white": event.player_white,
            "player_black": event.player_black,
            "initial_fen": event.initial_fen,
            "created_at": event.created_at,
        },
        "node_count": len(nodes),
        "leaf_hash": leaf_hash,
        "nodes": nodes,
    }
