export interface Opening {
  eco: string;
  name: string;
  moves: string[]; // UCI format e.g. ["e2e4", "c7c5", "g1f3", "d7d6"]
}

export const OPENINGS_DATABASE: Opening[] = [
  // King's Pawn
  { eco: "B00", name: "King's Pawn Opening", moves: ["e2e4"] },
  { eco: "C20", name: "Open Game", moves: ["e2e4", "e7e5"] },
  { eco: "C40", name: "King's Knight Opening", moves: ["e2e4", "e7e5", "g1f3"] },
  { eco: "C44", name: "King's Knight: Normal Variation", moves: ["e2e4", "e7e5", "g1f3", "b8c6"] },
  { eco: "C60", name: "Ruy Lopez", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"] },
  { eco: "C65", name: "Ruy Lopez: Berlin Defense", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "g8f6"] },
  { eco: "C70", name: "Ruy Lopez: Morphy Defense", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"] },
  { eco: "C78", name: "Ruy Lopez: Closed", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6", "b5a4", "g8f6", "e1g1"] },
  { eco: "C50", name: "Italian Game", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4"] },
  { eco: "C51", name: "Italian Game: Evans Gambit", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "b2b4"] },
  { eco: "C53", name: "Giuoco Piano", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3"] },
  { eco: "C55", name: "Two Knights Defense", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"] },
  { eco: "C45", name: "Scotch Game", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "d2d4"] },
  { eco: "C42", name: "Petrov Defense", moves: ["e2e4", "e7e5", "g1f3", "g8f6"] },
  { eco: "C46", name: "Three Knights Opening", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "b1c3"] },
  { eco: "C47", name: "Four Knights Game", moves: ["e2e4", "e7e5", "g1f3", "b8c6", "b1c3", "g8f6"] },
  { eco: "C30", name: "King's Gambit", moves: ["e2e4", "e7e5", "f2f4"] },
  { eco: "C21", name: "Center Game", moves: ["e2e4", "e7e5", "d2d4"] },
  { eco: "C23", name: "Bishop's Opening", moves: ["e2e4", "e7e5", "f1c4"] },
  { eco: "C25", name: "Vienna Game", moves: ["e2e4", "e7e5", "b1c3"] },

  // Sicilian Defense
  { eco: "B20", name: "Sicilian Defense", moves: ["e2e4", "c7c5"] },
  { eco: "B21", name: "Sicilian Defense: Smith-Morra Gambit", moves: ["e2e4", "c7c5", "d2d4", "c5d4", "c2c3"] },
  { eco: "B22", name: "Sicilian Defense: Alapin Variation", moves: ["e2e4", "c7c5", "c2c3"] },
  { eco: "B23", name: "Sicilian Defense: Closed", moves: ["e2e4", "c7c5", "b1c3"] },
  { eco: "B27", name: "Sicilian Defense: Open", moves: ["e2e4", "c7c5", "g1f3"] },
  { eco: "B30", name: "Sicilian Defense: Old Sicilian", moves: ["e2e4", "c7c5", "g1f3", "b8c6"] },
  { eco: "B50", name: "Sicilian Defense: Modern", moves: ["e2e4", "c7c5", "g1f3", "d7d6"] },
  { eco: "B90", name: "Sicilian Defense: Najdorf", moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"] },
  { eco: "B70", name: "Sicilian Defense: Dragon", moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "g7g6"] },
  { eco: "B80", name: "Sicilian Defense: Scheveningen", moves: ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "e7e6"] },
  { eco: "B40", name: "Sicilian Defense: French Variation", moves: ["e2e4", "c7c5", "g1f3", "e7e6"] },

  // French Defense
  { eco: "C00", name: "French Defense", moves: ["e2e4", "e7e6"] },
  { eco: "C01", name: "French Defense: Exchange Variation", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "e4d5"] },
  { eco: "C02", name: "French Defense: Advance Variation", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "e4e5"] },
  { eco: "C03", name: "French Defense: Tarrasch", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "b1d2"] },
  { eco: "C10", name: "French Defense: Paulsen", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3"] },
  { eco: "C11", name: "French Defense: Classical", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "g8f6"] },
  { eco: "C15", name: "French Defense: Winawer", moves: ["e2e4", "e7e6", "d2d4", "d7d5", "b1c3", "f8b4"] },

  // Caro-Kann
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e2e4", "c7c6"] },
  { eco: "B12", name: "Caro-Kann Defense: Advance Variation", moves: ["e2e4", "c7c6", "d2d4", "d7d5", "e4e5"] },
  { eco: "B13", name: "Caro-Kann Defense: Exchange Variation", moves: ["e2e4", "c7c6", "d2d4", "d7d5", "e4d5", "c6d5"] },
  { eco: "B15", name: "Caro-Kann Defense: Main Line", moves: ["e2e4", "c7c6", "d2d4", "d7d5", "b1c3", "d5e4", "c3e4"] },

  // Scandinavian & Others
  { eco: "B01", name: "Scandinavian Defense", moves: ["e2e4", "d7d5"] },
  { eco: "B01", name: "Scandinavian: Main Line", moves: ["e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5a5"] },
  { eco: "B02", name: "Alekhine Defense", moves: ["e2e4", "g8f6"] },
  { eco: "B07", name: "Pirc Defense", moves: ["e2e4", "d7d6", "d2d4", "g8f6", "b1c3", "g7g6"] },
  { eco: "B06", name: "Modern Defense", moves: ["e2e4", "g7g6"] },

  // Queen's Pawn
  { eco: "D00", name: "Queen's Pawn Game", moves: ["d2d4"] },
  { eco: "D00", name: "Queen's Pawn: d5", moves: ["d2d4", "d7d5"] },
  { eco: "D02", name: "London System", moves: ["d2d4", "d7d5", "g1f3", "g8f6", "c1f4"] },
  { eco: "D06", name: "Queen's Gambit", moves: ["d2d4", "d7d5", "c2c4"] },
  { eco: "D20", name: "Queen's Gambit Accepted", moves: ["d2d4", "d7d5", "c2c4", "d5c4"] },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d2d4", "d7d5", "c2c4", "e7e6"] },
  { eco: "D35", name: "QGD: Exchange Variation", moves: ["d2d4", "d7d5", "c2c4", "e7e6", "b1c3", "g8f6", "c4d5"] },
  { eco: "D10", name: "Slav Defense", moves: ["d2d4", "d7d5", "c2c4", "c7c6"] },
  { eco: "D43", name: "Semi-Slav Defense", moves: ["d2d4", "d7d5", "c2c4", "c7c6", "g1f3", "g8f6", "b1c3", "e7e6"] },

  // Indian Defenses
  { eco: "A45", name: "Indian Defense", moves: ["d2d4", "g8f6"] },
  { eco: "E60", name: "King's Indian Defense", moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7"] },
  { eco: "E90", name: "King's Indian: Classical", moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "f8g7", "e2e4", "d7d6", "g1f3", "e1g1"] },
  { eco: "E20", name: "Nimzo-Indian Defense", moves: ["d2d4", "g8f6", "c2c4", "e7e6", "b1c3", "f8b4"] },
  { eco: "E00", name: "Catalan Opening", moves: ["d2d4", "g8f6", "c2c4", "e7e6", "g2g3"] },
  { eco: "D80", name: "Grünfeld Defense", moves: ["d2d4", "g8f6", "c2c4", "g7g6", "b1c3", "d7d5"] },
  { eco: "E12", name: "Queen's Indian Defense", moves: ["d2d4", "g8f6", "c2c4", "e7e6", "g1f3", "b7b6"] },
  { eco: "A56", name: "Benoni Defense", moves: ["d2d4", "g8f6", "c2c4", "c7c5"] },
  { eco: "A80", name: "Dutch Defense", moves: ["d2d4", "f7f5"] },

  // Flank Openings
  { eco: "A10", name: "English Opening", moves: ["c2c4"] },
  { eco: "A20", name: "English: King's English", moves: ["c2c4", "e7e5"] },
  { eco: "A30", name: "English: Symmetrical", moves: ["c2c4", "c7c5"] },
  { eco: "A04", name: "Réti Opening", moves: ["g1f3"] },
  { eco: "A07", name: "King's Indian Attack", moves: ["g1f3", "d7d5", "g2g3"] },
  { eco: "A02", name: "Bird's Opening", moves: ["f2f4"] },
];

/**
 * Given a list of UCI moves played in a game, returns the deepest matching opening
 */
export function identifyOpening(uciMoves: string[]): { eco: string; name: string; bookPlyCount: number } {
  let bestMatch: Opening = { eco: "A00", name: "Custom Opening", moves: [] };
  let longestMatchLen = 0;

  for (const op of OPENINGS_DATABASE) {
    if (op.moves.length > uciMoves.length) continue;
    let match = true;
    for (let i = 0; i < op.moves.length; i++) {
      if (op.moves[i] !== uciMoves[i]) {
        match = false;
        break;
      }
    }
    if (match && op.moves.length > longestMatchLen) {
      bestMatch = op;
      longestMatchLen = op.moves.length;
    }
  }

  return {
    eco: bestMatch.eco,
    name: bestMatch.name,
    bookPlyCount: longestMatchLen,
  };
}

/**
 * Check whether a move at index `plyIndex` is a recognized book move
 */
export function isBookMove(uciMoves: string[], plyIndex: number): boolean {
  if (plyIndex >= uciMoves.length) return false;
  // Subsequence up to this move
  const sub = uciMoves.slice(0, plyIndex + 1);
  return OPENINGS_DATABASE.some(op => {
    if (op.moves.length < sub.length) return false;
    for (let i = 0; i < sub.length; i++) {
      if (op.moves[i] !== sub[i]) return false;
    }
    return true;
  });
}
