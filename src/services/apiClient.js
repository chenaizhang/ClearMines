import {
  autoMarkSelection as autoMarkSelectionLocal,
  flagCell as flagCellLocal,
  loadSnapshot,
  resetGame as resetLocalGame,
  revealCell as revealCellLocal
} from './localGameEngine.js';

const LEADERBOARD_STORAGE_KEY = 'clearbomb-leaderboard';
const MAX_ENTRIES_PER_DIFFICULTY = 100;

const safeReadLeaderboard = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

const safeWriteLeaderboard = (data) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // Ignore storage failures to preserve gameplay flow.
  }
};

const normaliseDifficultyKey = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 'custom';
  }
  return value;
};

export const fetchBoard = async () => loadSnapshot();

export const revealCell = async (position) => revealCellLocal(position);

export const flagCell = async (position) => flagCellLocal(position);

export const autoMarkSelection = async (selection) => autoMarkSelectionLocal(selection);

export const resetGame = async (config) => resetLocalGame(config);

export const fetchLeaderboard = async (difficulty, limit = 15) => {
  const key = normaliseDifficultyKey(difficulty);
  const collections = safeReadLeaderboard();
  const entries = Array.isArray(collections[key]) ? collections[key].slice() : [];
  entries.sort((a, b) => a.timeSeconds - b.timeSeconds || a.recordedAt.localeCompare(b.recordedAt));
  const trimmedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : entries.length;
  return { entries: entries.slice(0, trimmedLimit) };
};

export const submitLeaderboardEntry = async ({ username, difficulty, timeSeconds }) => {
  const trimmedName = typeof username === 'string' ? username.trim() : '';
  if (!trimmedName) {
    throw new Error('用户名不能为空');
  }

  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
    throw new Error('无效的通关时间');
  }

  const key = normaliseDifficultyKey(difficulty);
  const collections = safeReadLeaderboard();
  const bucket = Array.isArray(collections[key]) ? collections[key] : [];

  const entry = {
    username: trimmedName,
    difficulty: key,
    timeSeconds: Math.round(timeSeconds),
    recordedAt: new Date().toISOString()
  };

  const nextBucket = bucket.concat(entry);
  nextBucket.sort((a, b) => a.timeSeconds - b.timeSeconds || a.recordedAt.localeCompare(b.recordedAt));
  const limitedBucket = nextBucket.slice(0, MAX_ENTRIES_PER_DIFFICULTY);
  collections[key] = limitedBucket;
  safeWriteLeaderboard(collections);

  return { entry };
};
