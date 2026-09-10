import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chess Game Review & Accuracy Analyzer | Stockfish Powered',
  description:
    'Free chess game reviewer with move classifications (Brilliant, Great, Best, Blunder), win rate momentum, and accuracy scores just like Chess.com Game Review.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#161512] text-gray-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
