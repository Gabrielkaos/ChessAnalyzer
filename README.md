# Chess Game Review & Accuracy Analyzer ♟️

A full-featured chess game review web application powered by **Stockfish WebAssembly / Web Workers**, built with **Next.js**, **React**, and **Tailwind CSS**. It replicates and enhances the Chess.com style Game Review experience with move classifications (Brilliant, Great, Best, Book, Blunder), win rate momentum charting, phase performance breakdowns, and estimated Elo ratings.

Ready to deploy to **Vercel** with zero configuration!

---

## 🚀 Deploy to Vercel

### Option 1: Deploy via GitHub (Recommended)
1. Push this repository to your GitHub account:
   ```bash
   git add .
   git commit -m "Convert into full-stack Next.js web app ready for Vercel"
   git push origin master
   ```
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Select and import your `ChessAnalyzer` repository.
4. Vercel will automatically detect **Next.js** at the root.
5. Click **Deploy** — your app will be live with a free `.vercel.app` URL in less than 2 minutes!

### Option 2: Deploy with Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 💻 Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Build for production**:
   ```bash
   npm run build
   npm run start
   ```

---

## ✨ Features

- **Dual Built-in Engines**:
  - 🦅 **GOOB 2.2-BETA** (by Gabriel Montes): High-performance native UCI engine tuned for sharp tactical calculation, King safety evaluation, and dynamic piece play.
  - 🐟 **Stockfish 10** (WASM): Universal client-side engine running 100% in browser Web Workers. Zero server timeouts, zero compute bills, works completely offline.
  - ⚙️ **Custom Engine Support**: 1-click switch between engines, custom executable paths, or custom `.js` / `.wasm` worker files.
- **Move Classification System**:
  - 🌟 **Legendary**: Decisive turnaround move.
  - ✨ **Brilliant (!!)**: Sound piece sacrifice maintaining advantage.
  - 🎯 **Great (!)**: Only winning move or punishing opponent error.
  - ★ **Best**: Stockfish top engine recommendation.
  - ✓ **Excellent**: Strong move with minimal win rate loss (0-2%).
  - 👍 **Good**: Solid move (2-5% loss).
  - 📖 **Book**: Recognized opening moves with ECO classification.
  - ⚠️ **Inaccuracy (?!)**: Minor error (5-10% loss).
  - ❓ **Mistake (?)**: Significant mistake (10-20% loss).
  - ✕ **Miss**: Missed tactical win or punish.
  - 💥 **Blunder (??)**: Major error shifting win rate (>20% loss).
- **Game Review Summary Card**:
  - White & Black Accuracy score percentages (harmonic mean).
  - Estimated player Elo rating based on performance.
  - Opening, Middlegame, and Endgame breakdown.
  - Interactive classification filter: click on any category (e.g. "Blunders") to navigate straight to those moves.
- **Interactive Chessboard**:
  - Visual arrows showing played move (colored by classification) and engine best move (dashed green).
  - Previous move highlights and in-check pulsing indicator.
  - Click or drag-and-drop piece movement with legal move hints.
  - "Explore Alternate Lines": user can try other moves on the board with live Stockfish evaluation.
  - Board flip (White / Black perspective).
  - Sound effects for moves, captures, castling, checks, and brilliant moves.
- **Game Momentum / Evaluation Graph**:
  - Interactive SVG advantage curve across all moves.
  - Visual markers on blunders, mistakes, and brilliant sacrifices.
  - Click any point in the chart to jump to that exact move.
- **Import & Export**:
  - Paste any PGN with single or double-quoted headers.
  - Upload `.pgn` files from your device.
  - Preloaded sample master games (Gab's Saved Game, Kasparov's Immortal, Morphy's Opera Game, Fischer's Game of the Century).
  - Fetch games directly from Chess.com or Lichess by username!
  - Export annotated PGN with comments `{best=...}`.

---

## 🐍 Original Desktop Python GUI (Optional)

The original Pygame desktop application remains available in `ChessAnalyzer/`:
1. Install Python requirements:
   ```bash
   pip install -r requirements.txt
   ```
2. Place a native UCI engine (e.g. Stockfish) in `ChessAnalyzer/engines/`.
3. Run:
   ```bash
   cd ChessAnalyzer && python3 Run_gui.py
   ```

---

## 📜 License
GPL-3.0 License.
