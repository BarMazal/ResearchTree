# Enhanced Profile Analysis — Requirements Specification

## 1. Executive Summary
The **Enhanced Profile Analysis** system provides background, continuous move-by-move tracking and cognitive diagnostic analytics across chess games and riddle exercises. By modeling attempts as a bi-directional Directed Acyclic Graph (DAG) and snapshotting attempt sequences before `undo`, `restart`, or `fail` actions, the platform captures not just final outcomes, but *how the user thinks, where they blunder, and how they recover*.

---

## 2. Core Functional Requirements

### 2.1 Event & Move Logging
* **Event Types**:
  * `Game`: Can start from standard initial position or custom FEN setup in edit mode.
  * `Riddle`/`Exercise`: Starts from engine/Lichess/Mentor FEN position + specific goal task + tactical category tag.
* **Goal Types**:
  * Structured: `win_game`, `mate_in_K`, `capture_specific_piece`, `pass_pawn`, `force_tie`.
  * Special/Custom: Text prompt describing the target task.
* **Real-time Background Logging**:
  * Every move executed by the user is logged immediately with timestamps, remaining clock time, move time, and evaluation metrics.
* **Profile Isolation**:
  * Every event and move node is explicitly bound to a `profile_id`.

### 2.2 Attempt Branching & Failure Preservation
* When a user performs `undo`, `restart`, or `fail`:
  * The attempt sequence prior to the action is snapshot and preserved in the event's move DAG.
  * The abandoned/failed leaf node is flagged with its termination reason (`abandoned_undo`, `restart_fail`, `game_won`, `riddle_solved`).
  * A new attempt branch begins from the target position, preserving the error history for diagnostic analysis.

### 2.3 Cumulative Move-Node Metrics
Every move node along the sequence path tracks cumulative statistics up to that point:
* `blunder_count_so_far`: Count of severe tactical blunders.
* `missed_opportunity_count_so_far`: Count of missed tactical opportunities.
* `blunder_frequency`: $\frac{\text{blunder\_count\_so\_far}}{\text{move\_index}}$
* `missed_opportunity_frequency`: $\frac{\text{missed\_opportunity\_count\_so\_far}}{\text{move\_index}}$
* Objective time metrics: `clock_remaining_sec`, `move_time_sec`, `time_ratio`.

### 2.4 The 6-Aspect Tactical Metric Funnel
Every move evaluation evaluates two 3-stage funnels per category:
* **Offensive Funnel (User Attacking)**:
  1. *Opportunity Creation Rate (%)*: Frequency that the tactical situation was available.
  2. *Execution / Appliance Rate (%)*: Frequency the user successfully executed the tactic when available.
  3. *Material & Eval Yield (float)*: Average material/evaluation gain on successful execution.
* **Defensive Funnel (User Defending)**:
  4. *Opponent Threat Prevention Rate (%)*: Frequency that the opponent was prevented from creating the tactic (lower is better).
  5. *Defensive Failure Rate (%)*: Frequency that the opponent successfully executed the tactic against the user (lower is better).
  6. *Material & Eval Damage (float)*: Average material/evaluation lost when opponent executed tactic (lower is better).

### 2.5 Categorical Taxonomy
Categories are divided into two distinct operational types:
* **Proactive Goals (To Execute)**: `battery`, `x_ray`, `open_lines` (files & diagonals), `gain_space`, `develop_pieces`, `simplify_on_advantage`, `gambits`, `mate_in_X`, `famous_openings`.
* **Mistakes & Weaknesses (To Avoid)**: `unprotected_piece`, `overextension`, `expose_the_king`, `hanging_piece`, `defensive_failure`, `time_trouble_panic`.

### 2.6 Custom Filter Builder & System Presets
* **System Presets**: Opening Phase, Middlegame, Endgame, Blunders, Time Trouble.
* **Custom UI Filter Builder**: Users can construct, save, name, edit, and delete custom filter combinations (e.g. `[Profile] AND [Black] AND [Sicilian] AND [Time < 15s] AND [Missed Opportunity = 1]`).
* **Blunder Filter Preset**: Modeled as a prebuilt filter condition over 6 aspects (`Opportunity Created = 1 AND Executed = 0` OR `Opponent Threat = 1 AND Defensive Failure = 1`).

### 2.7 Category Governance & Settings
* **Auto-Promotion**: LLM-suggested custom categories auto-promote to reporting when appearing in $\ge 5\%$ (configurable) of profile events.
* **Manual Governance**: Settings screen allowing users to view, promote, demote, add, or delete categories manually.
* **Worker CPU Budget**: Configurable background analysis run-time budget per session and CPU usage limit.
* **Priority Queue**: `large_eval_deltas` ($|\Delta \text{eval}| > 1.5$) processed first.

### 2.8 Contextual History Inspection & Mentor Chat
* Interactive move timeline and evaluation graph with color-coded blunder markers.
* Finding cards detailing tactical opportunities and errors with engine principal variations.
* Interactive "Mentor Chat" on any historical position.

### 2.9 Testing & Debugging Scoping
* **Synthetic Data Seeder**: Generates 200+ realistic events scoped to a dedicated `QA` Profile.
* **Lichess Importer & Explorer**: 1-click import and live browsing of public Lichess games/puzzles.
* **In-Browser Debug Overlay**: Displays raw Stockfish depth/PV, LLM JSON prompts/responses, and timing logs strictly for `QA` Profile or Developer Mode.
