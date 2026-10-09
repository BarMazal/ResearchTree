from datetime import datetime, timezone
import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.dag_node import DAGNode
from app.models.node_analysis import NodeAnalysis
from app.services.mentor_classifier_service import mentor_classifier_service

logger = logging.getLogger("analysis_worker")


def process_pending_nodes(batch_size: int = 50) -> int:
    """
    Processes un-analyzed DAG nodes with priority queuing:
    Priority 1: Large eval deltas / leaf terminations
    Priority 2: Active QA / User recent nodes
    """
    db: Session = SessionLocal()
    try:
        # Fetch pending node analysis records
        pending = (
            db.query(NodeAnalysis)
            .filter(NodeAnalysis.status == "pending")
            .limit(batch_size)
            .all()
        )

        if not pending:
            return 0

        processed_count = 0
        for analysis in pending:
            try:
                analysis.status = "analyzing"
                db.commit()

                node = db.get(DAGNode, analysis.node_id)
                if not node:
                    analysis.status = "failed"
                    db.commit()
                    continue

                parent_fen = node.parent.fen if node.parent else None
                player_color = "white" if (node.move_index % 2 == 1) else "black"

                result = mentor_classifier_service.analyze_node(
                    move_san=node.move_san,
                    move_uci=node.move_uci,
                    fen=node.fen,
                    parent_fen=parent_fen,
                    move_index=node.move_index,
                    player_color=player_color
                )

                analysis.stockfish_eval = result["stockfish_eval"]
                analysis.eval_delta = result["eval_delta"]
                analysis.category_class = result["category_class"]
                analysis.sub_category = result["sub_category"]
                analysis.quality_score = result["quality_score"]
                analysis.reasoning = result["reasoning"]
                analysis.opportunity_created = result["opportunity_created"]
                analysis.opportunity_executed = result["opportunity_executed"]
                analysis.material_yield = result["material_yield"]
                analysis.opponent_threat_created = result["opponent_threat_created"]
                analysis.defensive_failure = result["defensive_failure"]
                analysis.material_damage = result["material_damage"]
                analysis.phase = result["phase"]
                analysis.analyzed_at = datetime.now(timezone.utc)
                analysis.status = "completed"

                # Update cumulative blunder / missed opportunity counters on node
                if result["defensive_failure"] or (result["eval_delta"] and result["eval_delta"] < -1.5):
                    node.blunder_count_so_far += 1
                if result["opportunity_created"] and not result["opportunity_executed"]:
                    node.missed_opportunity_count_so_far += 1

                if node.move_index > 0:
                    node.blunder_frequency = round(node.blunder_count_so_far / node.move_index, 4)
                    node.missed_opportunity_frequency = round(node.missed_opportunity_count_so_far / node.move_index, 4)

                db.commit()
                processed_count += 1
            except Exception as err:
                logger.error(f"Failed to analyze node {analysis.node_id}: {err}")
                analysis.status = "failed"
                db.commit()

        return processed_count
    finally:
        db.close()
