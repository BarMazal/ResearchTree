import random
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.database import engine, Base, SessionLocal
from app.models import Profile, Event, DAGNode, NodeAnalysis
from app.services.analysis_worker import process_pending_nodes

SAMPLE_SAN_MOVES = [
    ("e4", "e2e4"), ("e5", "e7e5"), ("Nf3", "g1f3"), ("Nc6", "b8c6"),
    ("Bc4", "f1c4"), ("Bc5", "f8c5"), ("c3", "c2c3"), ("Nf6", "g8f6"),
    ("d4", "d2d4"), ("exd4", "e5d4"), ("cxd4", "c3d4"), ("Bb4+", "c5b4"),
    ("Bd2", "c1d2"), ("Bxd2+", "b4d2"), ("Nbxd2", "b1d2"), ("d5", "d7d5"),
    ("exd5", "e4d5"), ("Nxd5", "f6d5"), ("Qb3", "d1b3"), ("Nce7", "c6e7")
]

CATEGORIES = ["openings", "endgames", "fork_double_attack", "pin_skewer", "king_safety", "pawn_mechanics"]

def seed_qa_data(num_events: int = 50):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("[Seed] Seeding QA Profile & Events...")
        qa_prof = db.query(Profile).filter(Profile.username == "qa_tester").first()
        if not qa_prof:
            qa_prof = Profile(username="qa_tester", display_name="QA Tester Profile", is_qa=True)
            db.add(qa_prof)
            db.commit()
            db.refresh(qa_prof)

        print(f"QA Profile ID: {qa_prof.id}")

        events_created = 0
        nodes_created = 0

        current_player_elo = 1400

        for i in range(num_events):
            event_class = "Game" if i % 4 != 0 else "Riddle"
            cat = random.choice(CATEGORIES)
            goal = "win_game" if event_class == "Game" else "mate_in_K"

            is_bot = (i % 2 == 0)
            opp_type = "bot" if is_bot else "human"
            opp_names_bot = ["Stockfish_Level_5", "Komodo_Engine", "Maia_1500", "Lichess_Bot_V2"]
            opp_names_human = ["Magnus_Fan_99", "TacticalMaster", "Grandmaster_Pro", "ChessWizard_88", "Rookie_Player"]
            opp_name = random.choice(opp_names_bot) if is_bot else random.choice(opp_names_human)
            opp_elo = random.randint(1300, 1950)

            is_win = random.random() > 0.35
            result_score = 1.0 if is_win else (0.5 if random.random() < 0.2 else 0.0)

            elo_change = int((result_score - 0.5) * 24 + random.randint(-4, 4))
            player_elo_before = current_player_elo
            current_player_elo = max(1000, current_player_elo + elo_change)
            player_elo_after = current_player_elo

            event = Event(
                profile_id=qa_prof.id,
                event_class=event_class,
                category=cat,
                goal_type=goal,
                status="done" if is_win else "failed",
                player_white="qa_tester" if i % 2 == 0 else opp_name,
                player_black=opp_name if i % 2 == 0 else "qa_tester",
                opponent_name=opp_name,
                opponent_type=opp_type,
                opponent_elo=opp_elo,
                player_elo_before=player_elo_before,
                player_elo_after=player_elo_after,
                result_score=result_score,
                initial_fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            )
            db.add(event)
            db.commit()
            db.refresh(event)
            events_created += 1

            # Root Node
            root_node = DAGNode(
                event_id=event.id,
                profile_id=qa_prof.id,
                parent_id=None,
                fen=event.initial_fen,
                move_index=0,
                is_leaf=False
            )
            db.add(root_node)
            db.commit()
            db.refresh(root_node)
            nodes_created += 1

            parent_node = root_node
            num_moves = random.randint(6, 18)
            clock = 300.0

            for m_idx in range(1, num_moves + 1):
                san, uci = SAMPLE_SAN_MOVES[(m_idx - 1) % len(SAMPLE_SAN_MOVES)]
                move_time = round(random.uniform(1.0, 8.0), 1)
                clock -= move_time

                # Simulate an undo branch on 15% of moves
                has_undo = random.random() < 0.15 and m_idx > 2
                if has_undo:
                    # Abandoned move attempt node
                    bad_node = DAGNode(
                        event_id=event.id,
                        profile_id=qa_prof.id,
                        parent_id=parent_node.id,
                        move_san="f3?",
                        move_uci="f2f3",
                        fen=parent_node.fen,
                        move_index=m_idx,
                        is_leaf=True,
                        leaf_termination="abandoned_undo",
                        clock_remaining_sec=clock,
                        move_time_sec=move_time
                    )
                    db.add(bad_node)
                    db.commit()
                    db.refresh(bad_node)
                    analysis_bad = NodeAnalysis(node_id=bad_node.id, status="pending")
                    db.add(analysis_bad)
                    nodes_created += 1

                # Active move node
                node = DAGNode(
                    event_id=event.id,
                    profile_id=qa_prof.id,
                    parent_id=parent_node.id,
                    move_san=san,
                    move_uci=uci,
                    fen=parent_node.fen,
                    move_index=m_idx,
                    is_leaf=(m_idx == num_moves),
                    leaf_termination="game_won" if (m_idx == num_moves and event.status == "done") else None,
                    clock_remaining_sec=clock,
                    move_time_sec=move_time
                )
                db.add(node)
                db.commit()
                db.refresh(node)
                nodes_created += 1

                analysis = NodeAnalysis(node_id=node.id, status="pending")
                db.add(analysis)
                db.commit()

                parent_node = node

        print(f"[Seed] Created {events_created} Events and {nodes_created} DAG Nodes for QA Profile.")
        print("[Worker] Processing pending analysis nodes with background worker...")
        processed = process_pending_nodes(batch_size=500)
        print(f"[Done] Analyzed {processed} nodes cleanly!")

    finally:
        db.close()

if __name__ == "__main__":
    seed_qa_data(50)
