import {
  autoMarkSelection as autoMarkSelectionLocal,
  flagCell as flagCellLocal,
  loadSnapshot,
  resetGame as resetLocalGame,
  revealCell as revealCellLocal
} from './localGameEngine.js';

const API_BASE = '/api';
const CLIENT_LEADERBOARD_LIMIT = 10;
const ALLOWED_DIFFICULTIES = new Set(['beginner', 'intermediate', 'expert']);

const normaliseDifficultyKey = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!ALLOWED_DIFFICULTIES.has(trimmed)) {
    return null;
  }
  return trimmed;
};

const parseJsonResponse = async (response) => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return {};
  }
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

const buildError = (message, fallback) => {
  if (typeof message === 'string' && message.trim()) {
    return new Error(message.trim());
  }
  return new Error(fallback);
};

export const fetchBoard = async () => loadSnapshot();

export const revealCell = async (position) => revealCellLocal(position);

export const flagCell = async (position) => flagCellLocal(position);

export const autoMarkSelection = async (selection) => autoMarkSelectionLocal(selection);

export const resetGame = async (config) => resetLocalGame(config);

export const fetchLeaderboard = async (difficulty, limit = CLIENT_LEADERBOARD_LIMIT) => {
  const key = normaliseDifficultyKey(difficulty);
  if (!key) {
    throw new Error('无效的难度');
  }

  const safeLimit = Math.min(
    CLIENT_LEADERBOARD_LIMIT,
    Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : CLIENT_LEADERBOARD_LIMIT
  );

  const searchParams = new URLSearchParams({ difficulty: key, limit: String(safeLimit) });
  const response = await fetch(`${API_BASE}/leaderboard?${searchParams.toString()}`, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    throw buildError(payload.error, '无法加载排行榜');
  }

  const payload = await parseJsonResponse(response);
  if (!payload || !Array.isArray(payload.entries)) {
    return { entries: [] };
  }

  return { entries: payload.entries.slice(0, CLIENT_LEADERBOARD_LIMIT) };
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
  if (!key) {
    throw new Error('无效的难度');
  }

  const response = await fetch(`${API_BASE}/leaderboard`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: trimmedName,
      difficulty: key,
      // 传两位小数
      timeSeconds: Math.round(timeSeconds * 100) / 100
    })
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw buildError(payload.error, '提交成绩失败');
  }

  return { entry: payload.entry };
};
