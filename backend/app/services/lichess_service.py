import urllib.request
import json
import logging
from sqlalchemy.orm import Session

from app.models.event import Event
from app.models.dag_node import DAGNode
from app.models.node_analysis import NodeAnalysis

logger = logging.getLogger("lichess_service")


class LichessService:
    BASE_URL = "https://lichess.org/api"

    @classmethod
    def fetch_user_games(cls, username: str, max_games: int = 10) -> list[dict]:
        """
        Fetches public recent games for a Lichess username in NDJSON format.
        """
        url = f"{cls.BASE_URL}/games/user/{username}?max={max_games}&evals=true&opening=true"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/x-ndjson",
                "User-Agent": "ResearchTree-ChessEngine/1.0"
            }
        )

        games = []
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                for line in resp:
                    line_str = line.decode("utf-8").strip()
                    if line_str:
                        try:
                            games.append(json.loads(line_str))
                        except Exception:
                            pass
        except Exception as err:
            logger.error(f"Failed to fetch Lichess games for {username}: {err}")

        return games

    @classmethod
    def fetch_puzzle(cls, puzzle_id: str) -> dict | None:
        """
        Fetches public puzzle metadata by Lichess puzzle ID.
        """
        url = f"{cls.BASE_URL}/puzzle/{puzzle_id}"
        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "ResearchTree-ChessEngine/1.0"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data
        except Exception as err:
            logger.error(f"Failed to fetch Lichess puzzle {puzzle_id}: {err}")
            return None

    @classmethod
    def import_game_to_event(cls, db: Session, profile_id: str, game_data: dict) -> Event:
        """
        Converts Lichess game JSON payload into an Event DAG in the database.
        """
        game_id = game_data.get("id", "lichess_game")
        players = game_data.get("players", {})
        white = players.get("white", {}).get("user", {}).get("name", "White")
        black = players.get("black", {}).get("user", {}).get("name", "Black")
        opening = game_data.get("opening", {}).get("name", "Openings")
        initial_fen = game_data.get("initialFen", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

        event = Event(
            profile_id=profile_id,
            event_class="Game",
            category=opening,
            goal_type="win_game",
            status="done" if game_data.get("winner") else "running",
            player_white=white,
            player_black=black,
            initial_fen=initial_fen
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        # Root Node
        root = DAGNode(
            event_id=event.id,
            profile_id=profile_id,
            parent_id=None,
            fen=initial_fen,
            move_index=0,
            is_leaf=False
        )
        db.add(root)
        db.commit()
        db.refresh(root)

        moves_str = game_data.get("moves", "")
        moves_list = moves_str.split() if moves_str else []

        parent_node = root
        for idx, uci in enumerate(moves_list, start=1):
            is_last = (idx == len(moves_list))
            node = DAGNode(
                event_id=event.id,
                profile_id=profile_id,
                parent_id=parent_node.id,
                move_san=uci,
                move_uci=uci,
                fen=initial_fen,
                move_index=idx,
                is_leaf=is_last,
                leaf_termination="game_won" if (is_last and game_data.get("winner")) else None
            )
            db.add(node)
            db.commit()
            db.refresh(node)

            analysis = NodeAnalysis(node_id=node.id, status="pending")
            db.add(analysis)
            db.commit()

            parent_node = node

        return event


lichess_service = LichessService()
