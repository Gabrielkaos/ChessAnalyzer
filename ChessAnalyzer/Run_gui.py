import pygame

import Board
from Asserts import is_piece_RQ
from Attacks import is_attacked
from Other_functions import FR_to_SQ
from Constants import piece, sq64_to_sq120, WHITE, mirror64, sq_to_str, sq120_to_sq64, piece_color, piece_big, rank7, \
    rank2, \
    BLACK, MVFLAGCA, START_FEN, MVFLAGEP, piece_value
from Analyzer import game_phase_cap
from I_o import parse_move, str_move
from Pv_table import move_really_exists
from Move_format import undo_move, CAPTURED, TOSQ
from Game import Game, HEIGHT, WIDTH, SQUARE_SIZE, DIM, mirrored_sq
import pyperclip
from Analyzer import accuracy_full_game, count_book_moves
from Move_format import make_move

pygame.init()

# TODO flexible move_capper function

pygame.display.set_caption("Gab Chess Gui")
pygame.display.set_icon(pygame.image.load("logo/gabchessgui.png"))
fen_font = pygame.font.Font('freesansbold.ttf', 13)
move_SFX = pygame.mixer.Sound("sounds/moves_sound.mp3")
castle_SFX = pygame.mixer.Sound("sounds/castle_sound.mp3")
capture_SFX = pygame.mixer.Sound("sounds/captured_sound.mp3")
game_start_SFX = pygame.mixer.Sound("sounds/game_start_chess.mp3.mp3")


def opposite_color(side):
    return WHITE if side == BLACK else BLACK


def move_cap(acc, move, best_move):
    if acc > 243.1: return "legendary"  # considered a legendary if you gain 20% win rate
    if acc > 124.9: return "brilliant"  # considered a brilliance if you gain 5% win rate
    if acc > 112.1: return "great"  # considered great if you gain 28 centipawns

    # conditioned best move
    # if not legendary and not brilliant and not great
    # but still the same as best move
    if move is not None and best_move is not None:
        if str_move(move) == best_move:
            # is_suicide = not does_this_color_have_more_attackers(move,opposite_color(board_now.side),board_now)
            # sacrifice = captured_a_less_value_piece(move,board_now)
            # if sacrifice and is_suicide: return "brilliant" #if captured a less value piece and suicide move
            # if is_suicide: return "great" #if opponent attacker is greater but great move return great
            return "best"
    if acc > 98.6: return "excellent"  # considered excellent if you only lost 3 centipawns
    if acc > 86.4: return "good"  # considered good if you only lost 35 centipawns
    if acc > 79.5: return "inaccuracy"  # if you lost 55 centipawns
    if acc > 67.5: return "mistake"  # if you lost 95 centipawns
    if acc <= 67.5: return "blunder"  # none of the above
    return ""


def find_things_from_fen(fen,fen_list):
    for pos in fen_list:
        if pos[0]==fen:
            return pos[1],pos[2],pos[3]

    return None,None,None

def find_the_move_and_cap(already_used, moves_from_pgn, move):
    if moves_from_pgn is None:
        return None, None

    for i in moves_from_pgn:
        if i[0] == move:
            if i in already_used:
                continue
            already_used.append(i)
            return i[0], i[1]
    return None, None


def still_losing(evaluation, side):
    if side == BLACK:
        if evaluation >= 500: return True
    else:
        if evaluation <= -500: return True
    return False


# 63 derived from brilliant move, 63 centipawn gain equals 5% winrate gain
def still_winning(evaluation, side):
    if side == WHITE:
        if (evaluation - 63) >= 500: return True
    else:
        if (evaluation + 63) <= -500: return True
    return False


def did_a_winning_capture(board_s, move):
    if piece_value[CAPTURED(move)] >= piece_value[board_s.pieces120[TOSQ(move)]]:
        return True
    return False


def position_winning_by(side,evaluation):
    if abs(evaluation)>=300:
        if evaluation > 0 and side==WHITE:return True
        if evaluation < 0 and side==BLACK:return True
    return False

def position_equalish(evaluation):
    if abs(evaluation) < 300: return True
    return False


def find_best_move_with_fen(fen, fen_with_moves):
    for i in fen_with_moves:
        if fen == i[0]:
            return i[1]

    return None


def something_is_attacked_by_lower_piece(board_s, side_to_check, is_pawn=False):
    if is_pawn:
        return is_attacked(board_s.kingSq[side_to_check],opposite_color(side_to_check),board_s)[0]
    white_pieces = [piece.white_rook, piece.white_knight, piece.white_bishop, piece.white_queen]
    black_pieces = [piece.black_rook, piece.black_knight, piece.black_bishop, piece.black_queen]

    our_pieces = white_pieces if side_to_check == WHITE else black_pieces

    for pce in our_pieces:
        for index in range(board_s.num_pieces[pce]):
            sq = board_s.piece_list[pce][index]

            something_is_attacked, the_attacker_sq = is_attacked(sq, opposite_color(side_to_check), board_s)
            if something_is_attacked is None: continue
            if something_is_attacked and piece_value[board_s.pieces120[the_attacker_sq]] < piece_value[pce]:
                return True
    return False


def load_fen_reqs():
    with open("pgns/load_req.txt","r") as f:
        positions = f.readlines()

    new_list = []
    for i in positions:
        fen = i.split(",")[0]
        best_move = i.split(",")[1]
        evals = i.split(",")[2]
        move_caps = i.split(",")[3]
        new_list.append((fen,best_move,evals,move_caps))

    return new_list

def main():
    engines_estimated_elo = 3000  # +100, -100

    """

    controls
    r - reset game
    c - copy fen
    LEFT - undo move
    RIGHT - make removed move again
    s - quit pygame and analyze and save game as pgn
    l - load pgn
    f - flip board
    """

    screen = pygame.display.set_mode((WIDTH + 50 + WIDTH // 2, HEIGHT))
    game = Game(screen, game_start_SFX, fen_font)

    # histories
    move_cap_hist = []
    move_recommended_hist = []
    eval_hist = []
    # already_used_move_comments = []
    copy_of_reversed_list = None

    # move cap and best move undone
    stored_move_cap_move = []
    loaded_fens_analyzed = load_fen_reqs()

    while True:
        screen.fill((120, 120, 120))

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                exit(0)
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r:
                    game.reset_game()
                elif event.key == pygame.K_f:
                    game.not_mirrored ^= True
                elif event.key == pygame.K_l:
                    try:
                        site_pgn = game.parse_pgn("pgns/saved_pgn.pgn")
                        copy_of_reversed_list = game.removed_move.copy()
                    except AttributeError:
                        continue
                    if site_pgn.lower() != "gabchessgui":
                        while len(game.removed_move) > 0:
                            move = parse_move(game.removed_move.pop(), game.board_state)
                            game.make_the_move(move)
                            if game_phase_cap(game.board_state) == "endgame": game.already_went_endgame = True
                    else:
                        game.we_should_display_caps = True
                        game.move_cap = None
                        game.best_move_recommended = None
                        game.eval_for_best = None
                elif event.key == pygame.K_s:
                    pygame.quit()

                    white_name = input("Enter white name:")
                    black_name = input("Enter black name:")
                    try:analysis_depth = int(input("Enter depth analysis:"))
                    except ValueError:analysis_depth = 18
                    # analysis_depth = 21

                    # engines_estimated_elo += elo_reduction(analysis_depth)

                    # if this is true, it means we are not loading a game from a pgn
                    if copy_of_reversed_list is None:
                        game.moves_history.reverse()
                        copy_of_reversed_list = []
                        for i in game.moves_history:
                            copy_of_reversed_list.append(str_move(i))
                        game.moves_history.reverse()

                    print()
                    fen_with_moves, phase_accuracy, eval_list, best_moves, accuracies, w_acc, b_acc = accuracy_full_game(
                        game.game_positions, analysis_depth, copy_of_reversed_list)
                    white_mid = phase_accuracy[0]
                    white_end = phase_accuracy[1]
                    black_mid = phase_accuracy[2]
                    black_end = phase_accuracy[3]
                    white_best_moves = best_moves[0]
                    black_best_moves = best_moves[1]
                    white_e = eval_list[0]
                    black_e = eval_list[1]

                    # move caps
                    bo_moves = [0, 0]
                    le_moves = [0, 0]
                    br_moves = [0, 0]
                    gr_moves = [0, 0]
                    ex_moves = [0, 0]
                    go_moves = [0, 0]
                    in_moves = [0, 0]
                    mis_moves = [0, 0]
                    blunders = [0, 0]
                    be_moves = [0, 0]

                    open('pgns/saved_pgn.pgn', 'w').close()  # delete content
                    file = open('pgns/saved_pgn.pgn', 'a')
                    file.writelines(f'[Event "Simple Game"]\n')
                    file.writelines(f'[Site "GabChessGui"]\n')
                    file.writelines(f"[White '{white_name}']\n")
                    file.writelines(f"[Black '{black_name}']\n")
                    if game.is_game_over() is None:
                        file.writelines("[Result '*']\n\n")
                    else:
                        file.writelines(f"[Result {game.is_game_over()[0]}]\n\n")

                    black_cap_hist = []
                    white_cap_hist = []

                    w_best_list = []
                    b_best_list = []

                    w_move_list = []
                    b_move_list = []

                    w_eval_list = []
                    b_eval_list = []

                    new_board = Board.Board()

                    new_board.parse_fen(START_FEN)

                    _, book_moves = count_book_moves(copy_of_reversed_list)

                    #stores fen,best_move,eval,move_cap
                    open("pgns/load_req.txt", "w").close()
                    fen_need_list = open("pgns/load_req.txt", "a")

                    # get info from the analyzer
                    for i in range(len(game.white_moves)):

                        try:
                            white_eval = white_e[i]
                        except IndexError:
                            white_eval = "None"
                        try:
                            black_eval = black_e[i]
                        except IndexError:
                            black_eval = "None"

                        w_best = b_best = ""

                        w_move = game.white_moves[i]
                        try:
                            b_move = game.black_moves[i]
                        except IndexError:
                            b_move = None

                        try:
                            w_move_cap = move_cap(accuracies[0][i], w_move,
                                                  None if w_move is None else white_best_moves[i])
                        except IndexError:
                            w_move_cap = ""

                        try:
                            b_move_cap = move_cap(accuracies[1][i], b_move,
                                                  None if b_move is None else black_best_moves[i])
                        except IndexError:
                            b_move_cap = ""

                        try:
                            if str_move(w_move) != white_best_moves[i]:
                                if w_move_cap not in ["best", "great", "brilliant", "legendary"]:
                                    w_best = find_best_move_with_fen(new_board.board_to_fen(), fen_with_moves)
                                    if w_best is None:
                                        print(fen_with_moves)
                                        print(new_board.board_to_fen())
                                        raise ValueError

                        except IndexError:
                            w_best = ""

                        white_in_check_earlier, _ = is_attacked(game.board_state.kingSq[WHITE],
                                                                BLACK,
                                                                game.board_state)
                        white_hanged_earlier = something_is_attacked_by_lower_piece(new_board, WHITE)

                        white_fen = new_board.board_to_fen()

                        if w_move is not None: make_move(new_board, w_move)

                        # if a move is sacrifice and the position is equalish then brilliant
                        if w_move_cap not in ["blunder","mistake","inaccuracy","good"]:
                            if white_eval != "None" and white_eval[0].lower() != "m" and white_eval is not None and \
                                    len(black_cap_hist)>0:
                                if (position_equalish(int(white_eval)) or (black_cap_hist[-1] in ["blunder", "mistake"] and not position_winning_by(BLACK,int(white_eval)))) and \
                                        something_is_attacked_by_lower_piece(new_board, WHITE,is_pawn=True) and \
                                        w_move_cap not in ["brilliant", "legendary"] and \
                                        not white_in_check_earlier and \
                                        not did_a_winning_capture(new_board, w_move):
                                    if white_hanged_earlier or is_piece_RQ(new_board.pieces120[TOSQ(w_move)]):
                                        w_move_cap = "brilliant"
                                    else:
                                        w_move_cap = "great"
                                        if black_cap_hist[-1] == "blunder": w_move_cap = "great"
                                        if black_cap_hist[-1] == "mistake": w_move_cap = "brilliant"




                        try:
                            if str_move(b_move) != black_best_moves[i]:
                                if b_move_cap not in ["best", "great", "brilliant", "legendary"]:
                                    b_best = find_best_move_with_fen(new_board.board_to_fen(), fen_with_moves)
                                    if b_best is None:
                                        print(fen_with_moves)
                                        print(new_board.board_to_fen())
                                        raise ValueError
                        except IndexError:
                            b_best = ""

                        black_in_check_earlier, _ = is_attacked(game.board_state.kingSq[BLACK],
                                                                WHITE,
                                                                game.board_state)
                        black_hanged_earlier = something_is_attacked_by_lower_piece(new_board, BLACK)

                        black_fen = new_board.board_to_fen()

                        if b_move is not None: make_move(new_board, b_move)


                        #if position is equal or white made a mistake and not winning by white
                        #not winning by white and something is attacked
                        #and move not brilliant already
                        #if black not in check earlier
                        #did not make a winning capture

                        # if a move is sacrifice and the position is equalish then brilliant
                        if b_move_cap not in ["blunder","mistake","inaccuracy","good"]:
                            if black_eval != "None" and black_eval[0].lower() != "m" and black_eval is not None:
                                if (position_equalish(int(black_eval)) or (w_move_cap in ["blunder","mistake"] and not position_winning_by(WHITE,int(black_eval)))) and \
                                        something_is_attacked_by_lower_piece(new_board, BLACK, is_pawn=True) and \
                                        b_move_cap not in ["brilliant", "legendary"] and \
                                        not black_in_check_earlier and \
                                        not did_a_winning_capture(new_board, b_move):
                                    print(b_move_cap)
                                    print("Hi I happened\n")

                                    if black_hanged_earlier or is_piece_RQ(new_board.pieces120[TOSQ(b_move)]):
                                        print(" I hanged earlier")
                                        b_move_cap = "brilliant"
                                    else:
                                        print("did not hanged earlier")
                                        b_move_cap = "great"
                                        if w_move_cap == "blunder": b_move_cap = "great"
                                        if w_move_cap == "mistake": b_move_cap = "brilliant"

                        # filtering brilliant moves, don't make it brilliant if we are still losing
                        # also if we are winning in way high margin
                        if black_eval != "None" and black_eval[0].lower() != "m":
                            if b_move_cap == "brilliant" and \
                                    (still_losing(int(black_eval), BLACK) or still_winning(int(black_eval), BLACK)):
                                b_move_cap = "best"

                        if white_eval != "None" and white_eval[0].lower() != "m":
                            if w_move_cap == "brilliant" and \
                                    (still_losing(int(white_eval), WHITE) or still_winning(int(white_eval), WHITE)):
                                w_move_cap = "best"

                        # if earlier move is blunder and the current move is best then its a great
                        if len(black_cap_hist) > 0 and w_move_cap == "best":
                            if black_cap_hist[-1] == "blunder": w_move_cap = "great"

                        if w_move_cap == "blunder" and b_move_cap == "best":
                            b_move_cap = "great"

                        # if black move is brilliant/great/legendary but also is white's, consider it not a brilliant
                        # vice verse
                        if len(black_cap_hist) > 0:
                            if black_cap_hist[-1] in ["great", "legendary", "brilliant"] and \
                                    w_move_cap == black_cap_hist[-1]:
                                w_move_cap = "best"
                                black_cap_hist[-1] = "best"
                        if b_move_cap in ["great", "brilliant", "legendary"] and \
                                w_move_cap == b_move_cap:
                            b_move_cap = "best"
                            w_move_cap = "best"

                        # flag some book moves
                        if w_move is not None:
                            if str_move(w_move) in book_moves:
                                w_move_cap = "book"
                                book_moves.remove(str_move(w_move))
                        if b_move is not None:
                            if str_move(b_move) in book_moves:
                                b_move_cap = "book"
                                book_moves.remove(str_move(b_move))


                        #if brilliant earlier make it not brilliant now
                        if len(black_cap_hist) > 0 and black_cap_hist[-1] == "brilliant" and b_move_cap == "brilliant":
                            b_move_cap = "best"
                        if len(white_cap_hist) > 0 and white_cap_hist[-1] == "brilliant" and w_move_cap == "brilliant":
                            w_move_cap = "best"

                        black_cap_hist.append(b_move_cap)
                        white_cap_hist.append(w_move_cap)

                        w_best_list.append(w_best)
                        b_best_list.append(b_best)

                        b_move_list.append(b_move)
                        w_move_list.append(w_move)

                        w_eval_list.append(white_eval)
                        b_eval_list.append(black_eval)

                        fen_need_list.writelines(f"{white_fen},{w_best},{white_eval},{w_move_cap},\n")
                        fen_need_list.writelines(f"{black_fen},{b_best},{black_eval},{b_move_cap},\n")


                    fen_need_list.close()

                    # write into pgn
                    for i in range(len(game.white_moves)):

                        w_move_cap = white_cap_hist[i]
                        b_move_cap = black_cap_hist[i]

                        w_best = w_best_list[i]
                        b_best = b_best_list[i]

                        w_move = w_move_list[i]
                        b_move = b_move_list[i]

                        white_eval = w_eval_list[i]
                        black_eval = b_eval_list[i]

                        if b_move_cap == "book": bo_moves[1] += 1
                        if w_move_cap == "book": bo_moves[0] += 1
                        if b_move_cap == "legendary": le_moves[1] += 1
                        if w_move_cap == "legendary": le_moves[0] += 1
                        if b_move_cap == "brilliant": br_moves[1] += 1
                        if w_move_cap == "brilliant": br_moves[0] += 1
                        if b_move_cap == "great": gr_moves[1] += 1
                        if w_move_cap == "great": gr_moves[0] += 1
                        if b_move_cap == "best": be_moves[1] += 1
                        if w_move_cap == "best": be_moves[0] += 1
                        if b_move_cap == "excellent": ex_moves[1] += 1
                        if w_move_cap == "excellent": ex_moves[0] += 1
                        if b_move_cap == "good": go_moves[1] += 1
                        if w_move_cap == "good": go_moves[0] += 1
                        if b_move_cap == "inaccuracy": in_moves[1] += 1
                        if w_move_cap == "inaccuracy": in_moves[0] += 1
                        if b_move_cap == "mistake": mis_moves[1] += 1
                        if w_move_cap == "mistake": mis_moves[0] += 1
                        if b_move_cap == "blunder": blunders[1] += 1
                        if w_move_cap == "blunder": blunders[0] += 1

                        if w_move_cap == "book": w_best = str_move(w_move)
                        if b_move_cap == "book": b_best = str_move(b_move)

                        w_move_cap = w_move_cap + ("" if w_best == "" else f" best={w_best}")
                        b_move_cap = b_move_cap + ("" if b_best == "" else f" best={b_best}")

                        file.writelines(
                            f"{i + 1}. {str_move(w_move)} {'{' + w_move_cap}={white_eval + '}'} {str_move(b_move)} {'{' + b_move_cap}={black_eval + '}'} ")
                        if i == len(game.white_moves) - 1:
                            file.writelines(
                                f"{'*' if game.is_game_over() is None else game.is_game_over()[1]}")

                    # game review
                    print(
                        f"\nAnalyzed at depth {analysis_depth}, Engine Evaluator estimated elo {engines_estimated_elo:.0f}")
                    print(f"\n\nwhite:{white_name}")
                    print(f"white book moves:{bo_moves[0]}")
                    print(f"white legendary moves:{le_moves[0]}")
                    print(f"white brilliant moves:{br_moves[0]}")
                    print(f"white great moves:{gr_moves[0]}")
                    print(f"white best moves:{be_moves[0]}")
                    print(f"white excellent moves:{ex_moves[0]}")
                    print(f"white good moves:{go_moves[0]}")
                    print(f"white inaccuracies:{in_moves[0]}")
                    print(f"white mistakes:{mis_moves[0]}")
                    print(f"white blunders:{blunders[0]}\n")
                    print(f"white middle game accuracy:{white_mid:.2f}%")
                    print(f"white end game accuracy:{white_end:.2f}%")
                    print(f"white overall accuracy:{w_acc:.2f}%")
                    print(f"white estimated elo: {int(engines_estimated_elo * (w_acc / 100.0))}\n\n")

                    print(f"black:{black_name}")
                    print(f"black book moves:{bo_moves[1]}")
                    print(f"black legendary moves:{le_moves[1]}")
                    print(f"black brilliant moves:{br_moves[1]}")
                    print(f"black great moves:{gr_moves[1]}")
                    print(f"black best moves:{be_moves[1]}")
                    print(f"black excellent moves:{ex_moves[1]}")
                    print(f"black good moves:{go_moves[1]}")
                    print(f"black inaccuracies:{in_moves[1]}")
                    print(f"black mistakes:{mis_moves[1]}")
                    print(f"black blunders:{blunders[1]}\n")
                    print(f"black middle game accuracy:{black_mid:.2f}%")
                    print(f"black end game accuracy:{black_end:.2f}%")
                    print(f"black overall accuracy:{b_acc:.2f}%")
                    print(f"black estimated elo: {int(engines_estimated_elo * (b_acc / 100.0))}")

                    open("review/review.txt", "w").close()
                    review_file = open("review/review.txt", "a")
                    review_file.writelines(
                        f"\nAnalyzed at depth {analysis_depth}, Engine estimated elo {engines_estimated_elo}\n")
                    review_file.writelines(f"\n\nwhite:{white_name}\n")
                    review_file.writelines(f"white book moves:{bo_moves[0]}\n")
                    review_file.writelines(f"white legendary moves:{le_moves[0]}\n")
                    review_file.writelines(f"white brilliant moves:{br_moves[0]}\n")
                    review_file.writelines(f"white great moves:{gr_moves[0]}\n")
                    review_file.writelines(f"white best moves:{be_moves[0]}\n")
                    review_file.writelines(f"white excellent moves:{ex_moves[0]}\n")
                    review_file.writelines(f"white good moves:{go_moves[0]}\n")
                    review_file.writelines(f"white inaccuracies:{in_moves[0]}\n")
                    review_file.writelines(f"white mistakes:{mis_moves[0]}\n")
                    review_file.writelines(f"white blunders:{blunders[0]}\n\n")
                    review_file.writelines(f"white middle game accuracy:{white_mid:.2f}%\n")
                    review_file.writelines(f"white end game accuracy:{white_end:.2f}%\n")
                    review_file.writelines(f"white overall accuracy:{w_acc:.2f}%\n")
                    review_file.writelines(f"white estimated elo: {int(engines_estimated_elo * (w_acc / 100.0))}\n\n\n")

                    review_file.writelines(f"black:{black_name}\n")
                    review_file.writelines(f"black book moves:{bo_moves[1]}\n")
                    review_file.writelines(f"black legendary moves:{le_moves[1]}\n")
                    review_file.writelines(f"black brilliant moves:{br_moves[1]}\n")
                    review_file.writelines(f"black great moves:{gr_moves[1]}\n")
                    review_file.writelines(f"black best moves:{be_moves[1]}\n")
                    review_file.writelines(f"black excellent moves:{ex_moves[1]}\n")
                    review_file.writelines(f"black good moves:{go_moves[1]}\n")
                    review_file.writelines(f"black inaccuracies:{in_moves[1]}\n")
                    review_file.writelines(f"black mistakes:{mis_moves[1]}\n")
                    review_file.writelines(f"black blunders:{blunders[1]}\n\n")
                    review_file.writelines(f"black middle game accuracy:{black_mid:.2f}%\n")
                    review_file.writelines(f"black end game accuracy:{black_end:.2f}%\n")
                    review_file.writelines(f"black overall accuracy:{b_acc:.2f}%\n")
                    review_file.writelines(f"black estimated elo: {int(engines_estimated_elo * (b_acc / 100.0))}\n")

                    review_file.close()

                    print("\nFile Saved")
                    file.close()

                    exit(0)
                elif event.key == pygame.K_RIGHT:
                    if len(game.removed_move) > 0:
                        move = parse_move(game.removed_move.pop(), game.board_state)
                        if game.we_should_display_caps:
                            if len(stored_move_cap_move) == 0:

                                game.best_move_recommended,game.eval_for_best,game.move_cap = \
                                    find_things_from_fen(game.board_state.board_to_fen(),loaded_fens_analyzed)

                                if game.best_move_recommended == "''" or \
                                        game.best_move_recommended == "" or \
                                        game.move_cap == "book":
                                    game.best_move_recommended = None

                            else:
                                earlier_caps_moves = stored_move_cap_move.pop()
                                game.move_cap = earlier_caps_moves[0]
                                game.best_move_recommended = earlier_caps_moves[1]
                                game.eval_for_best = earlier_caps_moves[2]

                            if game.best_move_recommended is not None and game.move_cap is not None:
                                if game.best_move_recommended in game.move_cap: game.move_cap = \
                                    game.move_cap.split("\n")[0]
                            if game.move_cap not in ["legendary", "brilliant", "great", "best", "excellent", "good",
                                                     "inaccuracy", "mistake", "blunder", "book"]:
                                game.move_cap = None
                            if game.best_move_recommended is None: game.best_move_recommended = str_move(move)
                            if " " in game.eval_for_best: game.eval_for_best = game.eval_for_best.split(" ")[0]
                            move_cap_hist.append(game.move_cap)
                            move_recommended_hist.append(game.best_move_recommended)
                            eval_hist.append(game.eval_for_best)
                        game.make_the_move(move)
                        if game.is_game_over():
                            eval_hist.pop()
                            game.eval_for_best = "GameOver"
                            eval_hist.append(game.eval_for_best)
                elif event.key == pygame.K_LEFT:
                    if game.board_state.his_ply > 0:
                        undo_move(game.board_state)
                        move = game.moves_history.pop()

                        # phase
                        if game_phase_cap(game.board_state) != "endgame":
                            game.already_went_endgame = False

                        earlier_move_cap = None
                        earlier_best_move = None
                        earlier_eval = None
                        if game.we_should_display_caps:
                            if len(move_cap_hist) >= 2:
                                earlier_move_cap = game.move_cap
                                game.move_cap = move_cap_hist[-2]
                            if len(eval_hist) >= 2:
                                earlier_eval = game.eval_for_best
                                game.eval_for_best = eval_hist[-2]
                            if len(move_recommended_hist) >= 2:
                                earlier_best_move = game.best_move_recommended
                                game.best_move_recommended = move_recommended_hist[-2]
                            # if len(already_used_move_comments) != 0: already_used_move_comments.pop()

                        stored_move_cap_move.append((earlier_move_cap, earlier_best_move, earlier_eval))

                        if len(move_recommended_hist) > 0:
                            move_recommended_hist.pop()
                            move_cap_hist.pop()
                            eval_hist.pop()
                        if game.get_side() == WHITE:
                            game.white_moves.pop()
                        else:
                            game.black_moves.pop()
                        game.removed_move.append(str_move(move))
                        if move & MVFLAGEP: game.captured_pieces.remove(
                            piece.white_pawn if game.get_side() == BLACK else piece.black_pawn)
                        if move in game.capture_history:
                            game.capture_history.remove(move)
                            game.captured_pieces.remove(CAPTURED(move))
                        game.move_made = True
                        game.game_positions.pop()
                        game.board_state.ply = 0
                elif event.key == pygame.K_c:
                    pyperclip.copy(game.board_state.board_to_fen())
            elif event.type == pygame.MOUSEBUTTONDOWN:
                if not game.is_game_over():
                    pos = pygame.mouse.get_pos()
                    col = pos[0] // SQUARE_SIZE
                    row = pos[1] // SQUARE_SIZE

                    sq120 = FR_to_SQ(col, row)
                    sq = sq120_to_sq64[sq120]

                    if game.sq_selected == sq or col >= DIM or col < 0:
                        game.reset_clicks()
                    else:
                        game.sq_selected = sq
                        game.sq_tuple = (row, col)
                        game.player_clicks.append(sq)

                    if len(game.player_clicks) == 2 and \
                            not game.we_should_display_caps:
                        if not game.not_mirrored:
                            move_str_from = sq_to_str[sq64_to_sq120[mirror64[game.player_clicks[0]]]]
                            move_str_to = sq_to_str[sq64_to_sq120[mirror64[game.player_clicks[1]]]]
                        else:
                            move_str_from = sq_to_str[mirrored_sq[game.player_clicks[0]]]
                            move_str_to = sq_to_str[mirrored_sq[game.player_clicks[1]]]

                        # handling promotions
                        if not game.not_mirrored:
                            from_pce = game.board_state.pieces120[sq64_to_sq120[mirror64[game.player_clicks[0]]]]
                        else:
                            from_pce = game.board_state.pieces120[mirrored_sq[game.player_clicks[0]]]
                        pce_color = piece_color[from_pce]
                        if not game.not_mirrored:
                            from_sq = sq64_to_sq120[mirror64[game.player_clicks[0]]]
                        else:
                            from_sq = mirrored_sq[game.player_clicks[0]]

                        promotion = ""
                        if not piece_big[from_pce] and pce_color == game.get_side():
                            if (game.get_side() == WHITE and from_sq in rank7) or \
                                    (game.get_side() == BLACK and from_sq in rank2):
                                promotion = input("select from [n,b,r,q]:")
                                if promotion not in ["q", "r", "b", "n"]:
                                    promotion = "q"

                        move = parse_move(move_str_from + move_str_to + promotion, game.board_state)

                        try:
                            if move_really_exists(game.board_state, move):
                                game.make_the_move(move)
                                game.reset_clicks()
                            else:
                                game.player_clicks = [game.sq_selected]
                        except AttributeError:
                            game.player_clicks = [game.sq_selected]

        if game.move_made:

            # sounds
            if (game.moves_history[-1] & MVFLAGEP if len(game.moves_history) > 0 else False) or \
                    (game.moves_history[-1] == game.capture_history[-1] if len(game.capture_history) > 0 else False):
                pygame.mixer.Sound.play(capture_SFX)
            elif len(game.moves_history) > 0 and (game.moves_history[-1] & MVFLAGCA):
                pygame.mixer.Sound.play(castle_SFX)
            else:
                pygame.mixer.Sound.play(move_SFX)

            # important things
            game.move_made = False
            game.update_valid_moves()

        game.draw_all()

        pygame.display.update()


if __name__ == '__MAIN__'.lower():
    main()
