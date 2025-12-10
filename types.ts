export type StoneColor = 'black' | 'white';

// Map key is "x,y"
export type BoardState = Record<string, StoneColor>;

export type BoardSize = 9 | 13 | 19;

export interface SavedShape {
  id: string;
  name: string;
  size: BoardSize;
  stones: BoardState;
  createdAt: number;
}

export interface Move {
  x: number;
  y: number;
  color: StoneColor;
  captures?: number; // How many stones were captured by this move
}

export interface GameRecord {
  id: string;
  date: string;
  blackPlayer: string;
  whitePlayer: string;
  size: BoardSize;
  result: string; // e.g. "B+Res", "W+5.5"
  notes: string;
  finalStones: BoardState; // Snapshot of end state
  moves: Move[];
  captures: { black: number, white: number }; // Stones captured BY that color
}

export type DrillPhase = 'idle' | 'memorize' | 'rebuild' | 'feedback';

export const STAR_POINTS: Record<BoardSize, number[][]> = {
  9: [[4, 4], [2, 2], [2, 6], [6, 2], [6, 6]],
  13: [[6, 6], [3, 3], [3, 9], [9, 3], [9, 9]],
  19: [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15]
  ]
};