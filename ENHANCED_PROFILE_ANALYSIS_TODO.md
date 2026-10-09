# Enhanced Profile Analysis — Implementation Roadmap & TODO

---

## 📍 Phase 1: Database Schema & SQLAlchemy Models
- [x] Create `Profile` model in `backend/app/models/profile.py` with `is_qa` flag.
- [x] Create `Event` model in `backend/app/models/event.py` (`Game` vs `Riddle`/`Exercise`, goals, setup FEN, category tags).
- [x] Create `DAGNode` model in `backend/app/models/dag_node.py` (parent_id, move_san, fen, leaf_termination, cumulative blunder/miss counters).
- [x] Create `NodeAnalysis` model in `backend/app/models/node_analysis.py` (stockfish_eval, eval_delta, 6-aspect flags, category, sub_category, reasoning).
- [x] Create `SavedFilter` model in `backend/app/models/saved_filter.py`.
- [x] Create `CategorySetting` model in `backend/app/models/category_setting.py` (promotion/demotion status).
- [x] Update `backend/app/models/__init__.py` and create database initialization/migration scripts.

---

## 📍 Phase 2: Core Event & DAG Logging API
- [x] Create Pydantic schemas in `backend/app/schemas/` (`profile`, `event`, `dag_node`, `saved_filter`, `category_setting`).
- [x] Implement `POST /api/profiles`, `GET /api/profiles`, `PUT`, `DELETE` in `backend/app/routes/profiles.py`.
- [x] Implement `POST /api/events` (Create new Game/Riddle event).
- [x] Implement `POST /api/events/{id}/moves` (Real-time background move logger with cumulative counters).
- [x] Implement `POST /api/events/{id}/undo` (Snapshot pre-undo attempt sequence, flag abandoned leaf, set active parent node).
- [x] Implement `POST /api/events/{id}/restart` (Snapshot pre-restart sequence, flag failed leaf, reset active node to root).
- [x] Implement `GET /api/events/{id}/dag` (Retrieve full bi-directional move tree with leaf hash index).
- [x] Register `profiles` and `events` routers in `backend/app/routes/__init__.py` and verify FastAPI endpoints.

---

## 📍 Phase 3: Stockfish + LLM Analysis Engine & Worker
- [ ] Build Stockfish 16 position evaluator service (`backend/app/services/stockfish_service.py`).
- [ ] Build LLM Mentor move classifier service (`backend/app/services/mentor_classifier_service.py`).
- [ ] Build resilient background analysis worker (`backend/app/services/analysis_worker.py`):
  - Priority Queue: `large_eval_deltas` ($|\Delta \text{eval}| > 1.5$) processed first.
  - Transactional per-node commits (`UNANALYZED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `ANALYZED`).
  - Worker CPU & Run-Time Budget controls via settings.
- [ ] Build 6-Aspect Metric Calculator (Offensive: Creation, Execution, Yield | Defensive: Prevention, Failure, Damage).

---

## 📍 Phase 4: QA Data Seeder & Lichess Importer
- [ ] Implement synthetic data seeder script (`scripts/seed_qa_data.py`) creating 200+ realistic QA profile events with move trees & blunder rates.
- [ ] Implement Lichess API importer service (`backend/app/services/lichess_service.py`) for streaming user games and puzzle FENs.
- [ ] Build Lichess Explorer UI tab (`frontend/src/components/LichessExplorer.tsx`).

---

## 📍 Phase 5: Filter Builder & Category Governance
- [ ] Implement CRUD backend endpoints for `SavedFilter` and `CategorySetting`.
- [ ] Build Custom UI Filter Builder (`frontend/src/components/FilterBuilder.tsx`) with prebuilt system presets (Opening, Middlegame, Endgame, Blunders, Time Trouble).
- [ ] Build Category Governance UI (`frontend/src/components/CategorySettings.tsx`) supporting manual promote/demote/add/delete + $5\%$ auto-promotion.

---

## 📍 Phase 6: History Inspector, Replay & Debug Overlay
- [ ] Build History Browser & Replay component (`frontend/src/components/HistoryInspector.tsx`) with evaluation curve and blunder markers.
- [ ] Build Finding Cards & interactive LLM Mentor Chat on historical positions.
- [ ] Build QA Debug Overlay (`frontend/src/components/DebugOverlay.tsx`) displaying raw Stockfish JSON, LLM prompts/responses, and manual re-evaluation trigger (scoped to QA profile).

---

## 📍 Phase 7: Analytics & Weakness Dashboard
- [ ] Build multi-dimensional SQL aggregation endpoints (`GET /api/analytics/summary`).
- [ ] Build 6-Aspect Radar/Funnel & categorical strength/weakness charts (`frontend/src/components/AnalyticsDashboard.tsx`).
- [ ] Build long-term category progress line charts.
