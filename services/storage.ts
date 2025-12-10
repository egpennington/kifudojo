import { GameRecord, SavedShape } from '../types';

const SHAPES_KEY = 'go_trainer_shapes';
const LOGS_KEY = 'go_trainer_logs';

export const loadShapes = (): SavedShape[] => {
  try {
    const raw = localStorage.getItem(SHAPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load shapes", e);
    return [];
  }
};

export const saveShapes = (shapes: SavedShape[]) => {
  localStorage.setItem(SHAPES_KEY, JSON.stringify(shapes));
};

export const loadLogs = (): GameRecord[] => {
  try {
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load logs", e);
    return [];
  }
};

export const saveLogs = (logs: GameRecord[]) => {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
};