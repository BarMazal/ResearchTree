import chess


class StockfishService:
    PIECE_VALUES = {
        chess.PAWN: 1.0,
        chess.KNIGHT: 3.0,
        chess.BISHOP: 3.25,
        chess.ROOK: 5.0,
        chess.QUEEN: 9.0,
        chess.KING: 0.0,
    }

    @classmethod
    def evaluate_fen(cls, fen: str) -> float:
        """
        Evaluates a FEN position returning evaluation score in centipawn/pawn units.
        Positive means White advantage, Negative means Black advantage.
        """
        try:
            board = chess.Board(fen)
            if board.is_checkmate():
                return -99.0 if board.turn == chess.WHITE else 99.0
            if board.is_stalemate() or board.is_insufficient_material():
                return 0.0

            white_score = 0.0
            black_score = 0.0

            for square, piece in board.piece_map().items():
                val = cls.PIECE_VALUES.get(piece.piece_type, 0.0)
                # Mobility bonus (number of legal attacks)
                attacks = len(board.attacks(square)) * 0.05
                total = val + attacks

                if piece.color == chess.WHITE:
                    white_score += total
                else:
                    black_score += total

            score = round(white_score - black_score, 2)
            return score
        except Exception:
            return 0.0

    @classmethod
    def calculate_eval_delta(cls, before_fen: str, after_fen: str, player_color: str = "white") -> float:
        """
        Calculates delta evaluation from the perspective of the player making the move.
        Positive delta means improvement for the player, Negative means loss/blunder.
        """
        eval_before = cls.evaluate_fen(before_fen)
        eval_after = cls.evaluate_fen(after_fen)

        raw_delta = eval_after - eval_before
        if player_color.lower() == "black":
            return round(-raw_delta, 2)
        return round(raw_delta, 2)


stockfish_service = StockfishService()
