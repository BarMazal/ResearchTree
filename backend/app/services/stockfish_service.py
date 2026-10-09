import os
import shutil
import chess
import chess.engine
from app.config import settings


class StockfishService:
    PIECE_VALUES = {
        chess.PAWN: 1.0,
        chess.KNIGHT: 3.0,
        chess.BISHOP: 3.25,
        chess.ROOK: 5.0,
        chess.QUEEN: 9.0,
        chess.KING: 0.0,
    }

    def __init__(self):
        self._engine_path = self._find_stockfish_binary()

    def _find_stockfish_binary(self) -> str | None:
        if settings.stockfish_path and os.path.exists(settings.stockfish_path):
            return settings.stockfish_path
        
        system_sf = shutil.which("stockfish") or shutil.which("stockfish.exe")
        if system_sf:
            return system_sf
            
        common_paths = [
            r"C:\Projects\chessbooklm\stockfish\stockfish.exe",
            r"C:\stockfish\stockfish.exe",
            r"C:\Program Files\Stockfish\stockfish.exe",
        ]
        for p in common_paths:
            if os.path.exists(p):
                return p
        return None

    def evaluate_fen(self, fen: str, time_limit: float = 0.05) -> float:
        """
        Evaluates a FEN position returning evaluation score in pawn units using Stockfish binary if present,
        or material heuristic fallback. Positive = White advantage, Negative = Black advantage.
        """
        if self._engine_path:
            try:
                board = chess.Board(fen)
                if board.is_checkmate():
                    return -99.0 if board.turn == chess.WHITE else 99.0
                if board.is_stalemate() or board.is_insufficient_material():
                    return 0.0

                engine = chess.engine.SimpleEngine.popen_uci(self._engine_path)
                try:
                    res = engine.analyse(board, chess.engine.Limit(time=time_limit))
                    score_obj = res.get("score")
                    if score_obj:
                        cp = score_obj.white().score(mate_score=9900)
                        if cp is not None:
                            return round(cp / 100.0, 2)
                finally:
                    engine.quit()
            except Exception as e:
                print(f"[StockfishService] UCI Engine evaluation failed ({e}), falling back to heuristic.")

        # Heuristic fallback if binary unavailable
        try:
            board = chess.Board(fen)
            if board.is_checkmate():
                return -99.0 if board.turn == chess.WHITE else 99.0
            if board.is_stalemate() or board.is_insufficient_material():
                return 0.0

            white_score = 0.0
            black_score = 0.0

            for square, piece in board.piece_map().items():
                val = self.PIECE_VALUES.get(piece.piece_type, 0.0)
                attacks = len(board.attacks(square)) * 0.05
                total = val + attacks

                if piece.color == chess.WHITE:
                    white_score += total
                else:
                    black_score += total

            return round(white_score - black_score, 2)
        except Exception:
            return 0.0

    def calculate_eval_delta(self, before_fen: str, after_fen: str, player_color: str = "white") -> float:
        """
        Calculates delta evaluation from the perspective of the player making the move.
        Positive delta means improvement for the player, Negative means loss/blunder.
        """
        eval_before = self.evaluate_fen(before_fen)
        eval_after = self.evaluate_fen(after_fen)

        raw_delta = eval_after - eval_before
        if player_color.lower() == "black":
            return round(-raw_delta, 2)
        return round(raw_delta, 2)


stockfish_service = StockfishService()
