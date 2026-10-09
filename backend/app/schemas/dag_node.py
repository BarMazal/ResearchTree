from datetime import datetime
from pydantic import BaseModel, Field


class NodeAnalysisRead(BaseModel):
    id: str
    node_id: str
    status: str
    stockfish_eval: float | None = None
    eval_delta: float | None = None
    category_class: str | None = None
    sub_category: str | None = None
    quality_score: float | None = None
    reasoning: str | None = None
    opportunity_created: bool = False
    opportunity_executed: bool = False
    material_yield: float = 0.0
    opponent_threat_created: bool = False
    defensive_failure: bool = False
    material_damage: float = 0.0
    phase: str | None = None
    analyzed_at: datetime | None = None

    model_config = {"from_attributes": True}


class MoveRecordCreate(BaseModel):
    move_san: str
    move_uci: str | None = None
    fen: str
    clock_remaining_sec: float | None = None
    move_time_sec: float | None = None


class DAGNodeRead(BaseModel):
    id: str
    event_id: str
    profile_id: str
    parent_id: str | None = None
    move_san: str | None = None
    move_uci: str | None = None
    fen: str
    move_index: int
    is_leaf: bool
    leaf_termination: str | None = None
    clock_remaining_sec: float | None = None
    move_time_sec: float | None = None
    blunder_count_so_far: int = 0
    missed_opportunity_count_so_far: int = 0
    blunder_frequency: float = 0.0
    missed_opportunity_frequency: float = 0.0
    created_at: datetime
    analysis: NodeAnalysisRead | None = None

    model_config = {"from_attributes": True}


class UndoRequest(BaseModel):
    target_node_id: str | None = None


class RestartRequest(BaseModel):
    pass
