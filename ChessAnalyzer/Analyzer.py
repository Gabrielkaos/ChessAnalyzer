import math
from subprocess import Popen, PIPE, STDOUT
import numpy as np
from Board import Board
from Attacks import is_attacked
from Move_gen import MoveList, generate_all_moves
from Run_engine import draw_by_material, is_repetition
from Move_format import make_move, undo_move
from Constants import WHITE

def game_phase_cap(board_state):
    if board_state.game_phase < 43:
        phase = "opening"
    elif 43 <= board_state.game_phase < 171:
        phase = "middle game"
    else:
        phase = "endgame"

    return phase


def is_over(board_state):
    if board_state.fifty_move >= 100:
        return "1/2-1/2", "{Draw by Fifty Move Rule}"

    if is_repetition(board_state):
        return "1/2-1/2", "{Draw by Threefold Repetition}"

    if draw_by_material(board_state):
        return "1/2-1/2", "{Insufficient Material}"

    move_list = MoveList()
    generate_all_moves(board_state, move_list)
    legal = 0
    for move_num in range(move_list.count):
        if not make_move(board_state, move_list.moves[move_num].move):
            continue

        legal += 1
        undo_move(board_state)
        break

    in_check, _ = is_attacked(board_state.kingSq[board_state.side], board_state.side ^ 1, board_state)
    if legal == 0:
        if in_check:
            if board_state.side == WHITE:
                return "0-1", "{Black win by Checkmate}"
            else:
                return "1-0", "{White win by Checkmate}"
        else:
            return "1/2-1/2", "{Stalemate}"
    return None


def get_harmonic_mean(num):
    average = 0

    if len(num) == 0: return 0.00

    for i in num:
        average += (1 / i)

    return len(num) / average


def win_rate(centipawns):
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * centipawns)) - 1)


def accuracy(win_before, win_after):
    return 103.1668 * math.exp(-0.04354 * (win_before - win_after)) - 3.1669


def get_eval(pos, the_engine, depth_limit):
    board = Board()
    board.parse_fen(pos)
    with_move = None
    real_eval = "M0"
    latest_depth = 1

    result = is_over(board)

    if result is not None:
        if result[0] == "1/2-1/2":
            return 0, "", real_eval, latest_depth
        if result[0] == "1-0" and board.side != WHITE:
            return -40000, "", real_eval, latest_depth
        if result[0] == "0-1" and board.side == WHITE:
            return -40000, "", real_eval, latest_depth

    score = 0
    input_one = f'position fen {pos}'.rstrip()
    command(the_engine, input_one)

    line = f"go depth {depth_limit}".rstrip()
    command(the_engine, line)
    for ELINES in iter(the_engine.stdout.readline, ''):
        e_line = ELINES.strip()
        # print(e_line)
        if 'cp' in e_line:
            score = int(e_line.split(" ")[e_line.split(" ").index("cp") + 1])
            colors = pos.split(" ")[1]
            real_eval = f"{-score if colors == 'b' else score}"
        elif 'mate' in e_line:
            mate_in = int(e_line.split(" ")[e_line.split(" ").index("mate") + 1])
            if mate_in > 0:
                mul = 1
            elif mate_in < 0:
                mul = -1
            else:
                mul = 1
            score = (40000 - abs(mate_in)) * mul
            colors = pos.split(" ")[1]
            real_eval = f"M{-mate_in if colors == 'b' else mate_in}"
        if 'depth' in e_line and 'currmove' not in e_line:
            latest_depth = int(e_line.split(" ")[e_line.split(" ").index("depth") + 1])
        if 'bestmove' in e_line:
            with_move = e_line
            break
    return score, with_move.split(" ")[1], real_eval, latest_depth


def init_engine(the_engine):
    command(the_engine, 'uci')
    command(the_engine, 'setoption name Threads value 4')
    command(the_engine, 'setoption name Hash value 256')
    command(the_engine, 'ucinewgame')
    command(the_engine, 'isready')
    command(the_engine, '')


def command(p, commands):
    p.stdin.write(f'{commands}\n')


def count_book_moves(moves):
    import chess
    import chess.polyglot
    import os

    not_reversed_moves = []
    for i in range(len(moves) - 1, -1, -1):
        # We need to clean the string in case it has trailing newlines from previous logic.
        not_reversed_moves.append(str(moves[i]).strip())

    board = chess.Board()
    book_moves_made = []

    book_path = os.path.join(os.path.dirname(__file__), 'books', 'book.bin')
    try:
        with chess.polyglot.open_reader(book_path) as reader:
            for move_str in not_reversed_moves:
                try:
                    # Find all book moves for current board
                    book_entries = list(reader.find_all(board))
                    book_move_strings = [entry.move.uci() for entry in book_entries]

                    if move_str in book_move_strings:
                        book_moves_made.append(move_str)
                        # Push the move to the board to update the position
                        board.push(chess.Move.from_uci(move_str))
                    else:
                        break # As soon as a move is not in the book, we stop
                except Exception:
                    break
    except Exception as e:
        print(f"Error reading book: {e}")

    longest_length = len(book_moves_made)
    return longest_length, book_moves_made


def get_best_engine():
    import os
    import sys
    import subprocess

    dirs_to_check = ['engines', 'ChessAnalyzer/engines', '../engines']
    engine_dir = None
    for d in dirs_to_check:
        if os.path.isdir(d):
            engine_dir = d
            break

    if not engine_dir:
        raise FileNotFoundError("No 'engines' directory found")

    # Windows detection:
    if sys.platform == 'win32':
        exe_files = [
            f for f in os.listdir(engine_dir)
            if f.lower().endswith('.exe') and os.path.isfile(os.path.join(engine_dir, f))
        ]
        if exe_files:
            goob_exe = [f for f in exe_files if 'goob' in f.lower()]
            chosen = goob_exe[0] if goob_exe else exe_files[0]
            chosen_path = os.path.join(engine_dir, chosen)
            print(f"[Engine] Windows detected: using executable {chosen_path}")
            return chosen_path
        raise FileNotFoundError(
            f"No Windows (.exe) engine found in '{engine_dir}'. "
            f"The four GOOB-2.2 builds provided are Linux ELF binaries. "
            f"Please place a Windows UCI engine (e.g. GOOB.exe) into '{engine_dir}' or run via WSL."
        )

    # Linux / POSIX detection:
    preferred_order = [
        ('GOOB-2.2-BETA-native', 'Native Host ISA (Zen 3 / Haswell tuned)'),
        ('GOOB-2.2-BETA-x86-64-v3', 'x86-64-v3 (AVX2 + BMI2 / PEXT bitboards)'),
        ('GOOB-2.2-BETA-x86-64-v2', 'x86-64-v2 (SSE4.2 + Hardware POPCNT)'),
        ('GOOB-2.2-BETA-x86-64', 'x86-64 Baseline (SSE2 - Universal compatibility)'),
    ]

    available = [f for f in os.listdir(engine_dir) if os.path.isfile(os.path.join(engine_dir, f))]
    if not available:
        raise FileNotFoundError(f"No engine found in {engine_dir}/ directory")

    # Ensure executable bit
    for f in available:
        fp = os.path.join(engine_dir, f)
        try:
            os.chmod(fp, 0o755)
        except Exception:
            pass

    # Probe in descending tier order to find fastest compatible binary for this CPU without SIGILL
    for cand_name, desc in preferred_order:
        if cand_name in available:
            cand_path = os.path.join(engine_dir, cand_name)
            try:
                res = subprocess.run(
                    [cand_path],
                    input='uci\nquit\n',
                    capture_output=True,
                    text=True,
                    timeout=1
                )
                if res.returncode == 0 and 'uciok' in res.stdout:
                    print(f"[Engine] Selected optimal build: {cand_name} ({desc})")
                    return cand_path
            except Exception as err:
                print(f"[Engine] {cand_name} not compatible with this CPU ({err}), testing fallback...")
                continue

    # Fallback to any file in directory that passes handshake
    for f in available:
        cand_path = os.path.join(engine_dir, f)
        try:
            res = subprocess.run([cand_path], input='uci\nquit\n', capture_output=True, text=True, timeout=1)
            if res.returncode == 0 and 'uciok' in res.stdout:
                print(f"[Engine] Fallback engine selected: {cand_path}")
                return cand_path
        except Exception:
            continue

    return os.path.join(engine_dir, available[0])


def accuracy_full_game(positions, analysis_depth, reversed_move_list):
    print(f"ANALYZING EACH MOVE TO DEPTH {analysis_depth} ...")
    _engine = get_best_engine()
    print(f'using engine={_engine}\n')

    # open the two engines each for each color
    the_engine = Popen([_engine], stdout=PIPE, stdin=PIPE, stderr=STDOUT, bufsize=0, text=True)
    the_engine2 = Popen([_engine], stdout=PIPE, stdin=PIPE, stderr=STDOUT, bufsize=0, text=True)

    # initialize
    init_engine(the_engine)
    init_engine(the_engine2)

    # variables
    already_went_endgame = False
    centipawns = []
    centipawns_black = []
    centipawns_mid_game = []
    centipawns_black_mid_game = []
    centipawns_end_game = []
    centipawns_black_end_game = []
    w_best_moves = []
    b_best_moves = []
    white_e = []
    black_e = []
    accuracy_lists_mid = []
    accuracy_lists_black_mid = []
    accuracy_lists_end = []
    accuracy_lists_black_end = []
    accuracy_lists = []
    accuracy_lists_black = []
    all_accuracy = []
    board_state = Board()

    fen_with_moves = []

    # loop through all the seen positions in the whole game
    for i, pos in enumerate(positions):

        board_state.parse_fen(pos)
        colors = pos.split(" ")[1]

        if colors == "w":
            evaluated, best_move, real_eval, _ = get_eval(pos, the_engine, analysis_depth)
            fen_with_moves.append((pos, best_move))
        else:
            evaluated, best_move, real_eval, _ = get_eval(pos, the_engine2, analysis_depth)
            fen_with_moves.append((pos, best_move))

        # append the best move, and evaluation
        if colors == "w":
            if i != 0: black_e.append(real_eval)
            w_best_moves.append(best_move)
        else:
            white_e.append(real_eval)
            b_best_moves.append(best_move)

        centipawns.append(evaluated if colors == "w" else -evaluated)
        centipawns_black.append(evaluated if colors == "b" else -evaluated)

        # separate evaluation list for middle game and end game
        if game_phase_cap(board_state) != "endgame" and not already_went_endgame:
            centipawns_mid_game.append(evaluated if colors == "w" else -evaluated)
            centipawns_black_mid_game.append(evaluated if colors == "b" else -evaluated)
        else:
            if not already_went_endgame: already_went_endgame = True
            centipawns_end_game.append(evaluated if colors == "w" else -evaluated)
            centipawns_black_end_game.append(evaluated if colors == "b" else -evaluated)

        if not is_over(board_state):
            print(
                f"Analyzed {'white' if colors == 'w' else 'black'} move {int(1 + (i - (1 if colors == 'b' else 0)) / 2)}")

    # initialize the win rate lists
    win_rate_lists = [win_rate(i) for i in centipawns]
    win_rate_lists_black = [win_rate(i) for i in centipawns_black]

    # initialize the win rate lists each for each game phase
    win_rate_lists_mid = [win_rate(i) for i in centipawns_mid_game]
    win_rate_lists_black_mid = [win_rate(i) for i in centipawns_black_mid_game]
    win_rate_lists_end = [win_rate(i) for i in centipawns_end_game]
    win_rate_lists_black_end = [win_rate(i) for i in centipawns_black_end_game]

    # get the accuracy based on the win rates
    for i in range(len(win_rate_lists_mid) - 1):
        if (i % 2) == 0:
            accuracy_lists_mid.append(max(accuracy(win_rate_lists_mid[i], win_rate_lists_mid[i + 1]), 10.00))
        elif (i % 2) != 0:
            accuracy_lists_black_mid.append(
                max(accuracy(win_rate_lists_black_mid[i], win_rate_lists_black_mid[i + 1]), 10.00))
    for i in range(len(win_rate_lists_end) - 1):
        if (i % 2) == 0:
            accuracy_lists_end.append(max(accuracy(win_rate_lists_end[i], win_rate_lists_end[i + 1]), 10.00))
        elif (i % 2) != 0:
            accuracy_lists_black_end.append(
                max(accuracy(win_rate_lists_black_end[i], win_rate_lists_black_end[i + 1]), 10.00))
    for i in range(len(win_rate_lists) - 1):
        if (i % 2) == 0:
            accuracy_lists.append(max(accuracy(win_rate_lists[i], win_rate_lists[i + 1]), 10.00))
        elif (i % 2) != 0:
            accuracy_lists_black.append(max(accuracy(win_rate_lists_black[i], win_rate_lists_black[i + 1]), 10.00))

    # book_moves
    longest_book, _ = count_book_moves(reversed_move_list)
    for i in range(longest_book):
        if (i % 2) == 0:
            accuracy_lists[i] = 100.00

            if i > (len(accuracy_lists_mid) - 1):
                accuracy_lists_end[i] = 100.00
            else:
                accuracy_lists_mid[i] = 100.00

        else:
            accuracy_lists_black[i] = 100.00

            if i > (len(accuracy_lists_black_mid) - 1):
                accuracy_lists_black_end[i] = 100.00
            else:
                accuracy_lists_black_mid[i] = 100.00

    all_accuracy.append(accuracy_lists)
    all_accuracy.append(accuracy_lists_black)
    accuracy_lists = np.array(accuracy_lists)
    accuracy_lists_black = np.array(accuracy_lists_black)
    accuracy_lists = np.clip(accuracy_lists, 10.0, 500.0)
    accuracy_lists_black = np.clip(accuracy_lists_black, 10.0, 500.0)

    command(the_engine, 'quit')
    command(the_engine2, 'quit')
    eval_list = [white_e, black_e]
    return fen_with_moves, [min(get_harmonic_mean(accuracy_lists_mid), 100.0),
                            min(get_harmonic_mean(accuracy_lists_end), 100.0),
                            min(get_harmonic_mean(accuracy_lists_black_mid), 100.0),
                            min(get_harmonic_mean(accuracy_lists_black_end), 100.0)], eval_list, [w_best_moves,
                                                                                                  b_best_moves], all_accuracy, min(
        get_harmonic_mean(accuracy_lists), 100.0), min(get_harmonic_mean(accuracy_lists_black), 100.0)


import threading

class LiveAnalyzer:
    def __init__(self):
        self.engine_path = get_best_engine()
        self.engine = Popen([self.engine_path], stdout=PIPE, stdin=PIPE, stderr=STDOUT, bufsize=1, universal_newlines=True)
        
        self.current_fen = None
        self.best_move = None
        self.evaluation = 0
        self.mate_found = False
        
        self.engine_name = "Unknown Engine"
        self.depth = 0
        self.seldepth = 0
        self.nodes = 0
        self.pv_moves = ""
        
        self.lock = threading.Lock()
        
        self._send_command('uci')
        self._send_command('setoption name Threads value 4')
        self._send_command('setoption name Hash value 256')
        self._send_command('isready')
        
        self.reader_thread = threading.Thread(target=self._read_output, daemon=True)
        self.reader_thread.start()

    def _send_command(self, cmd):
        try:
            self.engine.stdin.write(cmd + '\n')
            self.engine.stdin.flush()
        except Exception:
            pass

    def update_fen(self, fen):
        with self.lock:
            if self.current_fen == fen:
                return
            self.current_fen = fen
            
        self._send_command('stop')
        self._send_command('ucinewgame')
        self._send_command(f'position fen {fen}')
        self._send_command('go depth 20') # Use depth 20 to save CPU while still being accurate enough

    def get_analysis(self):
        with self.lock:
            return {
                'best_move': self.best_move,
                'evaluation': self.evaluation,
                'mate_found': self.mate_found,
                'engine_name': self.engine_name,
                'depth': self.depth,
                'seldepth': self.seldepth,
                'nodes': self.nodes,
                'pv': self.pv_moves
            }

    def quit(self):
        self._send_command('quit')

    def _read_output(self):
        for line in iter(self.engine.stdout.readline, ''):
            line = line.strip()
            if not line:
                continue
            
            if line.startswith('id name'):
                with self.lock:
                    self.engine_name = line.replace('id name', '').strip()
                    
            elif line.startswith('info'):
                parts = line.split()
                with self.lock:
                    try:
                        if 'depth' in parts:
                            self.depth = parts[parts.index('depth') + 1]
                        if 'seldepth' in parts:
                            self.seldepth = parts[parts.index('seldepth') + 1]
                        if 'nodes' in parts:
                            self.nodes = parts[parts.index('nodes') + 1]
                            
                        fen = self.current_fen
                        if fen and 'score' in parts:
                            score_idx = parts.index('score')
                            colors = fen.split(" ")[1]
                            if parts[score_idx + 1] == 'cp':
                                score = int(parts[score_idx + 2])
                                self.evaluation = score if colors == 'w' else -score
                                self.mate_found = False
                            elif parts[score_idx + 1] == 'mate':
                                mate_in = int(parts[score_idx + 2])
                                self.evaluation = mate_in if colors == 'w' else -mate_in
                                self.mate_found = True
                        
                        if 'pv' in parts:
                            pv_idx = parts.index('pv')
                            if pv_idx + 1 < len(parts):
                                self.best_move = parts[pv_idx + 1]
                                self.pv_moves = " ".join(parts[pv_idx + 1:pv_idx + 6])
                    except (ValueError, IndexError):
                        pass
            elif line.startswith('bestmove'):
                parts = line.split()
                if len(parts) >= 2:
                    with self.lock:
                        if parts[1] != "(none)":
                            self.best_move = parts[1]

if __name__ == "__main__":
    print(accuracy(win_rate(900), win_rate(0)))
