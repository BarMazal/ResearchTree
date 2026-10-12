import chess
from app.services.stockfish_service import stockfish_service


class MentorClassifierService:
    @classmethod
    def determine_phase(cls, board: chess.Board, move_index: int) -> str:
        if move_index <= 12:
            return "opening"
        piece_count = len(board.piece_map())
        queens = len(board.pieces(chess.QUEEN, chess.WHITE)) + len(board.pieces(chess.QUEEN, chess.BLACK))
        if piece_count <= 10 or queens == 0:
            return "endgame"
        return "middlegame"

    @classmethod
    def analyze_node(
        cls,
        move_san: str | None,
        move_uci: str | None,
        fen: str,
        parent_fen: str | None,
        move_index: int,
        player_color: str = "white",
        run_stockfish: bool = True,
        run_mentor: bool = True,
        current_stockfish_eval: float | None = None,
        current_eval_delta: float | None = None,
    ) -> dict:
        try:
            board = chess.Board(fen)
        except Exception:
            board = chess.Board()

        phase = cls.determine_phase(board, move_index)

        stockfish_eval = current_stockfish_eval
        eval_delta = current_eval_delta or 0.0

        if run_stockfish:
            stockfish_eval = stockfish_service.evaluate_fen(fen)
            if parent_fen:
                eval_delta = stockfish_service.calculate_eval_delta(parent_fen, fen, player_color)

        category_class = "positional_strategic"
        sub_category = "open_file_control"
        reasoning = f"Move {move_san or ''} executed during {phase}."

        opportunity_created = False
        opportunity_executed = False
        material_yield = 0.0

        opponent_threat_created = False
        defensive_failure = False
        material_damage = 0.0

        if run_mentor:
            # Heuristic detection for tactical motifs
            if eval_delta < -1.5:
                # Major blunder
                category_class = "unprotected_piece"
                sub_category = "hanging_piece"
                opponent_threat_created = True
                defensive_failure = True
                material_damage = abs(eval_delta)
                reasoning = f"Blunder detected: dropped {abs(eval_delta):.1f} pawns/eval."
            elif eval_delta > 1.5:
                # Major tactical gain
                category_class = "fork_double_attack"
                sub_category = "knight_fork" if "N" in (move_san or "") else "double_attack"
                opportunity_created = True
                opportunity_executed = True
                material_yield = eval_delta
                reasoning = f"Brilliant tactical move: gained +{eval_delta:.1f} in eval."
            elif eval_delta < -0.6:
                category_class = "overextension"
                sub_category = "inaccuracy"
                opponent_threat_created = True
                reasoning = f"Inaccuracy: positional evaluation decreased by {abs(eval_delta):.1f}."
            elif "x" in (move_san or ""):
                opportunity_created = True
                opportunity_executed = True
                material_yield = max(0.5, eval_delta)
                category_class = "simplify_on_advantage"
                sub_category = "piece_exchange"
                reasoning = f"Tactical trade executed with move {move_san}."
            elif "+" in (move_san or ""):
                opportunity_created = True
                opportunity_executed = True
                category_class = "king_safety"
                sub_category = "exposed_king"
                reasoning = f"Check delivered against opponent king."

        quality_score = max(0.0, min(1.0, round(0.5 + (eval_delta / 4.0), 2)))

        return {
            "stockfish_eval": stockfish_eval,
            "eval_delta": eval_delta,
            "category_class": category_class,
            "sub_category": sub_category,
            "quality_score": quality_score,
            "reasoning": reasoning,
            "opportunity_created": opportunity_created,
            "opportunity_executed": opportunity_executed,
            "material_yield": material_yield,
            "opponent_threat_created": opponent_threat_created,
            "defensive_failure": defensive_failure,
            "material_damage": material_damage,
            "phase": phase,
        }

    @classmethod
    def generate_event_title(
        cls,
        moves_san: list[str],
        player_white: str | None = None,
        player_black: str | None = None,
        result_score: float | None = 1.0,
    ) -> str:
        """
        AI Mentor auto-naming for event sessions based on ECO opening lines and game outcome.
        """
        opening_name = "Standard Game"
        moves_str = " ".join([m for m in moves_san if m])

        if moves_str.startswith("e4 c5"):
            opening_name = "Sicilian Defense"
        elif moves_str.startswith("e4 e5 Nf3 Nc6 Bb5"):
            opening_name = "Ruy Lopez"
        elif moves_str.startswith("e4 e5 Nf3 Nc6 Bc4"):
            opening_name = "Italian Game"
        elif moves_str.startswith("d4 d5 c4"):
            opening_name = "Queen's Gambit"
        elif moves_str.startswith("e4 e6"):
            opening_name = "French Defense"
        elif moves_str.startswith("e4 c6"):
            opening_name = "Caro-Kann Defense"
        elif moves_str.startswith("d4 Nf6"):
            opening_name = "Indian Defense"
        elif moves_str.startswith("e4 e5"):
            opening_name = "King's Pawn Game"
        elif moves_str.startswith("d4 d5"):
            opening_name = "Queen's Pawn Game"

        result_str = "Victory" if result_score >= 0.9 else ("Draw" if result_score >= 0.4 else "Defeat")
        players_str = f"{player_white or 'Player'} vs {player_black or 'Opponent'}"

        return f"{opening_name} • {result_str} ({players_str})"


mentor_classifier_service = MentorClassifierService()
