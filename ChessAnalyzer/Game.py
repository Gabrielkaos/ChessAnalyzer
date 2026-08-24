import chess.pgn
import math
import pygame
from Board import Board
import numpy as np
from Other_functions import FR_to_SQ
from Constants import piece, sq64_to_sq120, WHITE, mirror64, sq120_to_sq64, piece_color, \
    BLACK, MVFLAGEP, str_to_sq
from Move_gen import generate_all_moves
from Run_engine import draw_by_material, is_repetition
from Move_format import make_move, FROMSQ, TOSQ, MoveList, undo_move
from Attacks import is_attacked
from Squares import *

piece_dictss = {1: "wp", 4: "wR", 2: "wN",
                3: "wB", 5: "wQ", 6: "wK",
                7: "bp", 10: "bR", 8: "bN",
                9: "bB", 11: "bQ", 12: "bK"
                }
DIM = 8
HEIGHT = WIDTH = DIM * 100
SQUARE_SIZE = HEIGHT // DIM
pieces_arr = ["wp", "wN", "wB", "wR", "wQ", "wK", "bp", "bN", "bB", "bR", "bQ", "bK"]
mirror_col = [7, 6, 5, 4, 3, 2, 1, 0]
mirrored_sq = [
    h1, g1, f1, e1, d1, c1, b1, a1,
    h2, g2, f2, e2, d2, c2, b2, a2,
    h3, g3, f3, e3, d3, c3, b3, a3,
    h4, g4, f4, e4, d4, c4, b4, a4,
    h5, g5, f5, e5, d5, c5, b5, a5,
    h6, g6, f6, e6, d6, c6, b6, a6,
    h7, g7, f7, e7, d7, c7, b7, a7,
    h8, g8, f8, e8, d8, c8, b8, a8,
]


def is_legal_move(move, gs):
    lists = MoveList()
    generate_all_moves(gs, lists)

    for i in range(lists.count):
        moves = lists.moves[i].move

        if not make_move(gs, moves):
            continue

        undo_move(gs)

        if move == moves:
            return moves

    return 0


def load_images():
    images = {}
    for piecess in pieces_arr:
        images[piecess] = pygame.transform.scale(pygame.image.load("images/" + piecess + ".png"),
                                                 (SQUARE_SIZE, SQUARE_SIZE))
    return images


def init2d():
    board2d = []
    r = 0
    for i in range(DIM):
        f = 0
        for j in range(DIM):
            board2d.append((r, f))
            f += 1
        r += 1

    return board2d


class Game:
    def __init__(self, screen, game_start_SFX, fen_font):

        self.square_color_based_on_cap = {"best": pygame.Color("green"),
                                          "blunder": pygame.Color("red"),
                                          "book": pygame.Color("brown"),
                                          "brilliant": pygame.Color("blue"),
                                          "excellent": pygame.Color("green"),
                                          "good": pygame.Color((87, 228, 101)),
                                          "great": pygame.Color("light blue"),
                                          "inaccuracy": pygame.Color((255, 181, 84)),
                                          "legendary": pygame.Color("violet"),
                                          "mistake": pygame.Color("orange")}
        self.colors = [pygame.Color((160, 190, 160)), pygame.Color((0, 100, 0))]
        self.reversed_colors = [pygame.Color((0, 100, 0)), pygame.Color((160, 190, 160))]
        self.fen_font = fen_font
        self.game_start_SFX = game_start_SFX
        self.win = screen
        self.d2_board = init2d()
        self.images = load_images()

        # self.move_comments = None
        self.we_should_display_caps = False
        self.best_move_recommended = None
        self.eval_for_best = None
        self.move_cap = None
        self.already_went_endgame = False
        self.current_drawn_eval = 0.0
        self.target_eval = 0.0

        self.removed_move = []
        self.white_moves = []
        self.black_moves = []
        self.captured_pieces = []
        self.board_state = Board()
        self.game_positions = [self.board_state.board_to_fen()]
        self.move_made = False
        self.valid_moves = MoveList()
        generate_all_moves(self.board_state, self.valid_moves)
        self.moves_history = []
        self.capture_history = []
        self.not_mirrored = False

        # inputs
        self.sq_selected = None
        self.player_clicks = []
        self.sq_tuple = (8, 8)
        pygame.mixer.Sound.play(game_start_SFX)

    def update_valid_moves(self):
        self.valid_moves = MoveList()
        generate_all_moves(self.board_state, self.valid_moves)

    def highlight_squares(self):
        if self.sq_selected is not None:
            if self.not_mirrored:
                pce = self.board_state.pieces120[mirrored_sq[self.sq_selected]]
            else:
                pce = self.board_state.pieces120[sq64_to_sq120[mirror64[self.sq_selected]]]
            r, c = self.sq_tuple
            if piece_color[pce] == self.get_side():
                s = pygame.Surface((SQUARE_SIZE, SQUARE_SIZE))
                s.set_alpha(110)
                s.fill(pygame.Color((255, 255, 0)))
                self.win.blit(s, (c * SQUARE_SIZE, r * SQUARE_SIZE))
                s.fill(pygame.Color((255, 0, 0)))
                s.set_alpha(80)
                for i in range(self.valid_moves.count):
                    move = self.valid_moves.moves[i].move
                    sqto64 = mirror64[sq120_to_sq64[TOSQ(move)]] if not self.not_mirrored else sq120_to_sq64[TOSQ(move)]
                    move = is_legal_move(move, self.board_state)
                    if move != 0:
                        sq11 = sq64_to_sq120[mirror64[self.sq_selected]] if not self.not_mirrored else mirrored_sq[
                            self.sq_selected]
                        if sq11 == FROMSQ(move):
                            if self.not_mirrored:
                                self.win.blit(s, (mirror_col[self.d2_board[sqto64][1]] * SQUARE_SIZE,
                                                  self.d2_board[sqto64][0] * SQUARE_SIZE))
                            else:
                                self.win.blit(s, (
                                    self.d2_board[sqto64][1] * SQUARE_SIZE, self.d2_board[sqto64][0] * SQUARE_SIZE))

    def draw_board(self):
        for row in range(8):
            for col in range(8):
                color = self.colors[(row + col) % 2]
                pygame.draw.rect(self.win, color,
                                 pygame.Rect(col * SQUARE_SIZE, row * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE))

        if len(self.moves_history) > 0:
            move = self.moves_history[-1]
            r, c = self.d2_board[mirror64[sq120_to_sq64[FROMSQ(move)]]] if not self.not_mirrored else self.d2_board[
                sq120_to_sq64[FROMSQ(move)]]
            if self.not_mirrored: c = mirror_col[c]
            s = pygame.Surface((SQUARE_SIZE, SQUARE_SIZE))
            s.set_alpha(110)
            if self.we_should_display_caps and self.move_cap is not None:
                s.fill(self.square_color_based_on_cap[self.move_cap])
            else:
                s.fill(pygame.Color((255, 255, 0)))
            self.win.blit(s, (c * SQUARE_SIZE, r * SQUARE_SIZE))
            r, c = self.d2_board[mirror64[sq120_to_sq64[TOSQ(move)]]] if not self.not_mirrored else self.d2_board[
                sq120_to_sq64[TOSQ(move)]]
            if self.not_mirrored: c = mirror_col[c]
            self.win.blit(s, (c * SQUARE_SIZE, r * SQUARE_SIZE))

    def draw_pieces(self):
        temp_board = self.board_state.pieces120
        temp_board = temp_board.reshape(12, 10)
        if not self.not_mirrored:
            temp_board = np.flipud(temp_board)
        else:
            temp_board = np.fliplr(temp_board)
        temp_board = temp_board.reshape(120)

        for r in range(DIM):
            for f in range(DIM):
                sq = FR_to_SQ(f, r)

                piecess = temp_board[sq]
                if piecess != piece.EMPTY and piecess != piece.OFF_BOARD:
                    self.win.blit(self.images[piece_dictss[piecess]],
                                  pygame.Rect(f * SQUARE_SIZE, r * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE))

    def draw_move_caps(self):
        try:
            if self.we_should_display_caps:
                if self.move_cap is not None:
                    sqto64 = mirror64[sq120_to_sq64[TOSQ(self.moves_history[-1])]] if not self.not_mirrored else \
                        sq120_to_sq64[mirrored_sq[sq120_to_sq64[TOSQ(self.moves_history[-1])]]]

                    # display caps and color the squares

                    image_cap = pygame.transform.scale(pygame.image.load("images/" + self.move_cap + ".png"),
                                                       (SQUARE_SIZE // 2, SQUARE_SIZE // 2))
                    self.win.blit(image_cap,
                                  (self.d2_board[sqto64][1] * SQUARE_SIZE, self.d2_board[sqto64][0] * SQUARE_SIZE,
                                   SQUARE_SIZE, SQUARE_SIZE))
                if self.best_move_recommended is not None:
                    sq64_from = mirror64[sq120_to_sq64[str_to_sq[self.best_move_recommended[:2]]]] \
                        if not self.not_mirrored else sq120_to_sq64[
                        mirrored_sq[sq120_to_sq64[str_to_sq[self.best_move_recommended[:2]]]]]
                    sq64_to = mirror64[sq120_to_sq64[str_to_sq[self.best_move_recommended[2:4]]]] \
                        if not self.not_mirrored else sq120_to_sq64[
                        mirrored_sq[sq120_to_sq64[str_to_sq[self.best_move_recommended[2:4]]]]]

                    x_pos = ((self.d2_board[sq64_from][1] * SQUARE_SIZE) + SQUARE_SIZE // 2,
                             (self.d2_board[sq64_from][0] * SQUARE_SIZE) + SQUARE_SIZE // 2)
                    y_pos = ((self.d2_board[sq64_to][1] * SQUARE_SIZE) + SQUARE_SIZE // 2,
                             (self.d2_board[sq64_to][0] * SQUARE_SIZE) + SQUARE_SIZE // 2)
                    pygame.draw.line(self.win, pygame.Color("green"), x_pos,
                                     y_pos, 4)
                    pygame.draw.circle(self.win, pygame.Color("green"), y_pos, SQUARE_SIZE // 8)


        except IndexError:
            pass

    def draw_info(self):
        offset = 60
        font_color = (220, 220, 220)
        header_color = (150, 200, 255)
        
        # Info Panel Background
        info_rect = pygame.Rect(WIDTH + 40, 0, (WIDTH // 2) + 10, HEIGHT)
        pygame.draw.rect(self.win, (40, 42, 45), info_rect)
        
        # Helper to draw aligned text
        def draw_text(title, value, y_pos, t_color=header_color, v_color=font_color):
            t_surface = self.fen_font.render(f"{title}: ", True, t_color)
            v_surface = self.fen_font.render(str(value), True, v_color)
            self.win.blit(t_surface, (WIDTH + offset, y_pos))
            self.win.blit(v_surface, (WIDTH + offset + t_surface.get_width(), y_pos))

        # Game Phase
        if self.board_state.game_phase < 43:
            phase = "Endgame" if self.already_went_endgame else "Opening"
        elif 43 <= self.board_state.game_phase < 171:
            phase = "Endgame" if self.already_went_endgame else "Middle Game"
        else:
            if not self.already_went_endgame: self.already_went_endgame = True
            phase = "Endgame"

        move_number = str(int(1 + (self.board_state.his_ply - (self.board_state.side == BLACK)) / 2))
        
        draw_text("Move Number", move_number, 30)
        draw_text("Phase", phase.upper(), 60)
        draw_text("50 Move Rule", int(self.board_state.fifty_move), 90)

        # if in check
        in_check, _ = is_attacked(self.board_state.kingSq[self.board_state.side], self.board_state.side ^ 1, self.board_state)
        if in_check:
            check_surface = self.fen_font.render("IN CHECK!", True, (255, 100, 100))
            self.win.blit(check_surface, (WIDTH + offset, 120))

        self.draw_captured()

        if self.we_should_display_caps:
            draw_text("Engine Best", self.best_move_recommended, 240)
            draw_text("Evaluation", self.eval_for_best, 270)
            
            if hasattr(self, 'engine_details') and self.engine_details:
                draw_text("Engine", self.engine_details.get('engine_name', ''), 300)
                draw_text("Depth", f"{self.engine_details.get('depth', 0)}/{self.engine_details.get('seldepth', 0)}", 330)
                draw_text("Nodes", self.engine_details.get('nodes', 0), 360)
                draw_text("PV", self.engine_details.get('pv', ''), 390)

            if self.eval_for_best is not None:
                if "M" not in self.eval_for_best and "G" not in self.eval_for_best:
                    real_eval = int(self.eval_for_best)
                else:
                    if "G" not in self.eval_for_best:
                        real_eval = int(self.eval_for_best[1:])
                    else:
                        real_eval = 0
                mate_found = "M" in self.eval_for_best
            else:
                mate_found = False
                real_eval = 0
            self.draw_eval_bar(real_eval, mate_found)
            
        # Draw Controls Guide
        controls_y = HEIGHT - 220
        c_title = self.fen_font.render("--- CONTROLS ---", True, header_color)
        self.win.blit(c_title, (WIDTH + offset, controls_y))
        
        controls = [
            ("L", "Load saved game (PGN)"),
            ("S", "Analyze & Save game"),
            ("Left/Right", "Undo / Redo Move"),
            ("F", "Flip Board"),
            ("R", "Reset Game"),
            ("C", "Copy FEN")
        ]
        
        for i, (key, desc) in enumerate(controls):
            k_surf = self.fen_font.render(f"[{key}]", True, (200, 200, 100))
            d_surf = self.fen_font.render(f" - {desc}", True, font_color)
            self.win.blit(k_surf, (WIDTH + offset, controls_y + 30 + i * 25))
            self.win.blit(d_surf, (WIDTH + offset + k_surf.get_width(), controls_y + 30 + i * 25))

    def draw_eval_bar(self, evaluation, mate_found):
        if mate_found:
            target = 10000 if evaluation > 0 else -10000
        else:
            target = evaluation
            
        self.target_eval = target
        
        # Smooth interpolation (lerp)
        self.current_drawn_eval += (self.target_eval - self.current_drawn_eval) * 0.1
        
        # Use sigmoid (win probability) to map eval to a 0-1 percentage
        try:
            win_prob = 0.5 + 0.5 * (2 / (1 + math.exp(-0.00368208 * self.current_drawn_eval)) - 1)
        except OverflowError:
            win_prob = 1.0 if self.current_drawn_eval > 0 else 0.0
            
        x1 = WIDTH
        x2 = WIDTH + 40
        
        # Standard: Black on top, White on bottom
        black_height = int(HEIGHT * (1.0 - win_prob))
        white_height = HEIGHT - black_height
        
        eval_bar_black = pygame.Rect((x1, 0), (x2 - x1, black_height))
        eval_bar_white = pygame.Rect((x1, black_height), (x2 - x1, white_height))
        
        pygame.draw.rect(self.win, (40, 40, 40), eval_bar_black)
        pygame.draw.rect(self.win, (240, 240, 240), eval_bar_white)
        
        # Add modern text indicator
        if mate_found:
            eval_str = f"M{abs(evaluation)}"
        else:
            eval_str = f"{abs(evaluation)/100:.1f}"
            
        text = self.fen_font.render(eval_str, True, (200, 200, 200) if self.target_eval < 0 else (100, 100, 100))
        # Place text at the top if black is winning, or bottom if white is winning
        y_pos = 20 if self.target_eval < 0 else HEIGHT - 20
        text_rect = text.get_rect(center=(x1 + 20, y_pos))
        self.win.blit(text, text_rect)

    def reset_clicks(self):
        self.sq_selected = None
        self.player_clicks = []
        self.sq_tuple = (8, 8)

    def is_game_over(self):
        if self.board_state.fifty_move >= 100:
            return "1/2-1/2", "{Draw by Fifty Move Rule}"

        if is_repetition(self.board_state):
            return "1/2-1/2", "{Draw by Threefold Repetition}"

        if draw_by_material(self.board_state):
            return "1/2-1/2", "{Insufficient Material}"

        move_list = MoveList()
        generate_all_moves(self.board_state, move_list)
        legal = 0
        for move_num in range(move_list.count):
            if not make_move(self.board_state, move_list.moves[move_num].move):
                continue

            legal += 1
            undo_move(self.board_state)
            break

        in_check, _ = is_attacked(self.board_state.kingSq[self.board_state.side], self.board_state.side ^ 1,
                                  self.board_state)
        if legal == 0:
            if in_check:
                if self.board_state.side == WHITE:
                    return "0-1", "{Black win by Checkmate}"
                else:
                    return "1-0", "{White win by Checkmate}"
            else:
                return "1/2-1/2", "{Stalemate}"
        return None

    def get_side(self):
        return self.board_state.side

    def draw_captured(self):
        white_caps = 0
        black_caps = 0
        offset = 60
        for cap in self.captured_pieces:
            if piece_color[cap] == WHITE:
                self.win.blit(pygame.transform.scale(self.images[piece_dictss[cap]], (20, 20)),
                              pygame.Rect(WIDTH + offset + (white_caps * 11), 180, SQUARE_SIZE, SQUARE_SIZE))
                white_caps += 1
            else:
                self.win.blit(pygame.transform.scale(self.images[piece_dictss[cap]], (20, 20)),
                              pygame.Rect(WIDTH + offset + (black_caps * 11), 150, SQUARE_SIZE, SQUARE_SIZE))
                black_caps += 1

    def reset_game(self):
        # self.move_comments = None
        self.we_should_display_caps = False
        self.best_move_recommended = None
        self.eval_for_best = None
        self.move_cap = None
        self.already_went_endgame = False

        self.removed_move = []
        self.white_moves = []
        self.black_moves = []
        self.captured_pieces = []
        self.board_state = Board()
        self.game_positions = [self.board_state.board_to_fen()]
        self.move_made = False
        self.valid_moves = MoveList()
        generate_all_moves(self.board_state, self.valid_moves)
        self.moves_history = []
        self.capture_history = []
        self.not_mirrored = False

        # inputs
        self.sq_selected = None
        self.player_clicks = []
        self.sq_tuple = (8, 8)
        pygame.mixer.Sound.play(self.game_start_SFX)

    def draw_all(self):
        self.draw_board()
        self.highlight_squares()
        self.draw_pieces()
        self.draw_info()
        self.draw_move_caps()

    def parse_pgn(self, path):
        self.reset_game()
        game_pgn = chess.pgn.read_game(open(path, 'r'))

        main_moves = []
        for move in game_pgn.mainline_moves():
            main_moves.append(str(move))

        for i in range(len(main_moves) - 1, -1, -1):
            move = main_moves[i]
            self.removed_move.append(move)

        return game_pgn.headers["Site"]

    def make_the_move(self, move):
        to_sq = TOSQ(move)
        we_captured = self.board_state.pieces120[to_sq] != piece.EMPTY
        self.moves_history.append(move)
        if move & MVFLAGEP: self.captured_pieces.append(
            piece.white_pawn if self.get_side() == BLACK else piece.black_pawn)
        if we_captured:
            self.capture_history.append(move)
            self.captured_pieces.append(self.board_state.pieces120[to_sq])
        if self.get_side() == WHITE:
            self.white_moves.append(move)
        else:
            self.black_moves.append(move)
        make_move(self.board_state, move)
        self.game_positions.append(self.board_state.board_to_fen())
        self.board_state.ply = 0
        self.move_made = True
