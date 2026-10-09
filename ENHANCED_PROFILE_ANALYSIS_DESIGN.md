# Enhanced Profile Analysis — Technical Architecture & Design Document

## 1. System Architecture Overview

The Enhanced Profile Analysis framework consists of a **Bi-Directional Event DAG**, an **Asynchronous Priority Analysis Worker**, a **Two-Tiered OLAP Aggregation Engine**, and a **Contextual History Inspector UI**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React/TS)                           │
│  Analytics Dashboard | Filter Builder | History Replay | Debug Overlay   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │  REST / WebSocket
┌────────────────────────────────────▼────────────────────────────────────┐
│                           BACKEND (FastAPI/Python)                       │
│  Event Service | DAG Engine | Stockfish Worker | LLM Mentor Service     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │  SQLAlchemy
┌────────────────────────────────────▼────────────────────────────────────┐
│                           DATABASE (SQLite/Postgres)                    │
│  profiles | events | dag_nodes | node_analysis | saved_filters          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema Design

### 2.1 `profiles`
* `id`: VARCHAR (PK)
* `username`: VARCHAR
* `is_qa`: BOOLEAN (Default: False)
* `created_at`: TIMESTAMP

### 2.2 `events`
* `id`: VARCHAR (PK)
* `profile_id`: VARCHAR (FK -> profiles.id)
* `class`: VARCHAR ("Game" | "Riddle" | "Exercise")
* `category`: VARCHAR (e.g. "openings", "endgames", "mate_in_K")
* `goal_type`: VARCHAR ("win_game", "mate_in_K", "capture_specific_piece", "pass_pawn", "force_tie", "custom")
* `goal_description`: TEXT
* `status`: VARCHAR ("running", "done", "failed")
* `player_white`: VARCHAR
* `player_black`: VARCHAR
* `initial_fen`: TEXT
* `created_at`: TIMESTAMP
* `updated_at`: TIMESTAMP

### 2.3 `dag_nodes`
* `id`: VARCHAR (PK)
* `event_id`: VARCHAR (FK -> events.id)
* `profile_id`: VARCHAR (FK -> profiles.id)
* `parent_id`: VARCHAR (FK -> dag_nodes.id, NULL for root)
* `move_san`: VARCHAR (e.g. "Nxd5")
* `move_uci`: VARCHAR (e.g. "e2e4")
* `fen`: TEXT
* `move_index`: INTEGER
* `is_leaf`: BOOLEAN
* `leaf_termination`: VARCHAR (NULL, "abandoned_undo", "restart_fail", "game_won", "riddle_solved")
* `clock_remaining_sec`: FLOAT
* `move_time_sec`: FLOAT
* `blunder_count_so_far`: INTEGER
* `missed_opportunity_count_so_far`: INTEGER
* `blunder_frequency`: FLOAT
* `missed_opportunity_frequency`: FLOAT
* `created_at`: TIMESTAMP

### 2.4 `node_analysis`
* `id`: VARCHAR (PK)
* `node_id`: VARCHAR (FK -> dag_nodes.id, UNIQUE)
* `status`: VARCHAR ("pending", "analyzing", "completed", "failed")
* `stockfish_eval`: FLOAT
* `eval_delta`: FLOAT
* `category_class`: VARCHAR (e.g. "fork_double_attack", "pin_skewer")
* `sub_category`: VARCHAR (e.g. "knight_fork", "unprotected_piece")
* `quality_score`: FLOAT (0.0 to 1.0)
* `reasoning`: TEXT
* `opportunity_created`: BOOLEAN
* `opportunity_executed`: BOOLEAN
* `material_yield`: FLOAT
* `opponent_threat_created`: BOOLEAN
* `defensive_failure`: BOOLEAN
* `material_damage`: FLOAT
* `phase`: VARCHAR ("opening", "middlegame", "endgame")
* `analyzed_at`: TIMESTAMP

### 2.5 `saved_filters`
* `id`: VARCHAR (PK)
* `profile_id`: VARCHAR (FK -> profiles.id)
* `name`: VARCHAR
* `filter_config`: JSON (Serialized filter tree)
* `created_at`: TIMESTAMP

### 2.6 `category_settings`
* `id`: VARCHAR (PK)
* `profile_id`: VARCHAR (FK -> profiles.id)
* `category_key`: VARCHAR
* `is_custom`: BOOLEAN
* `status`: VARCHAR ("canonical", "promoted", "demoted", "custom_pending")
* `occurrence_count`: INTEGER

---

## 3. DAG Traversal & Reversed Path Reconstruction

```
[Root FEN] <--- [Node 1] <--- [Node 2] <--- [Node 3 (Leaf: abandoned_undo)]
                                 ^
                                 └── [Node 4 (Leaf: game_won)]
```

* **Reverse Path Algorithm**:
  Starting from any leaf node `L`, walk backwards via `parent_id` to `Root`.
  Reconstructing the attempt sequence takes $O(M)$ steps, where $M$ is move depth.
* **Leaf Hash Table**:
  Maintain a lookup index mapping `leaf_id -> node_id` for instant attempt selection.

---

## 4. Two-Tiered Analysis & Aggregation Pipeline

```
  Event Completed / Move Logged
                │
                ▼ (Tier 1: Async Worker)
  Run Stockfish + LLM Extractor (ONCE per node)
                │
                ▼
  Store Invariant Result in node_analysis Table
                │
                ▼ (Tier 2: OLAP Aggregate Query)
  Fast SQL Aggregation across Filter Criteria (< 2ms)
```

---

## 5. Async Worker Resiliency & Priority Queue

* **Priority 1 (Urgent)**: Nodes with $|\Delta \text{eval}| > 1.5$ or game end states.
* **Priority 2 (Normal)**: Active user's recently finished events.
* **Priority 3 (Background)**: Historical un-analyzed nodes.
* **Worker Execution Budget**: Configurable via `Settings` (Max CPU %, max run-time per session).
* **Fault Tolerance**: Transactions committed per-node with status state transitions (`UNANALYZED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `ANALYZED`). Failed jobs resume seamlessly on server restart.

---

## 6. Frontend Component Architecture

1. **`AnalyticsDashboard.tsx`**:
   * 6-Aspect Metric Radar & Funnel charts.
   * Long-term category progress line charts.
   * Categorical strength & weakness distribution.
2. **`FilterBuilder.tsx`**:
   * Visual query builder for custom filters (`[Profile] AND [Category] AND [Aspects]`).
   * Save, edit, and delete custom filter presets.
3. **`HistoryInspector.tsx`**:
   * Move timeline & interactive evaluation curve.
   * Finding cards detailing tactical opportunities/errors with principal variations.
   * Interactive LLM Mentor Chat on any position.
4. **`DebugOverlay.tsx`**:
   * Raw Stockfish JSON, LLM prompt/response viewer, and manual re-evaluation trigger (Scoped to `QA` Profile).
5. **`LichessExplorer.tsx`**:
   * 1-click import and live browsing of public Lichess games/puzzles.
