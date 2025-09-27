const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'leaderboard.json');
const MAX_ENTRIES_PER_BOARD = 100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const ALLOWED_DIFFICULTIES = new Set([
  'beginner',
  'intermediate',
  'expert'
]);

let cache = null;
let cacheLoaded = false;

const ensureDataFile = async () => {
  if (cacheLoaded) {
    return cache;
  }

  cacheLoaded = true;
  try {
    const raw = await fsp.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      cache = parsed;
    }
  } catch (error) {
    cache = {};
  }

  if (!cache || typeof cache !== 'object') {
    cache = {};
  }

  return cache;
};

const persistData = async () => {
  if (!cache) {
    return;
  }
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.writeFile(DATA_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    // Logging to stderr is sufficient for local development debugging.
    console.error('Failed to persist leaderboard data', error);
  }
};

const normaliseDifficulty = (input) => {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim().toLowerCase();
  if (!ALLOWED_DIFFICULTIES.has(trimmed)) {
    return null;
  }
  return trimmed;
};

const normaliseLimit = (input) => {
  const value = Number.parseInt(input, 10);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(value, MAX_LIMIT);
};

const readRequestBody = (request) => new Promise((resolve, reject) => {
  const chunks = [];
  request.on('data', (chunk) => {
    chunks.push(chunk);
  });
  request.on('error', (error) => {
    reject(error);
  });
  request.on('end', () => {
    const buffer = Buffer.concat(chunks);
    resolve(buffer.toString('utf8'));
  });
});

const sendJson = (response, statusCode, payload) => {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  response.end(body);
};

const handleGetLeaderboard = async (request, response, query) => {
  const difficulty = normaliseDifficulty(query.difficulty);
  if (!difficulty) {
    sendJson(response, 400, { error: 'invalid difficulty' });
    return;
  }

  const limit = normaliseLimit(query.limit);
  const data = await ensureDataFile();
  const entries = Array.isArray(data[difficulty]) ? data[difficulty] : [];

  sendJson(response, 200, { entries: entries.slice(0, limit) });
};

const toSafeUsername = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length > 64) {
    return trimmed.slice(0, 64);
  }
  return trimmed;
};

const toSafeTimeSeconds = (value) => {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
};

const handleSubmitLeaderboard = async (request, response) => {
  const rawBody = await readRequestBody(request);
  let payload;
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch (error) {
    sendJson(response, 400, { error: 'invalid JSON payload' });
    return;
  }

  const difficulty = normaliseDifficulty(payload.difficulty);
  if (!difficulty) {
    sendJson(response, 400, { error: 'invalid difficulty' });
    return;
  }

  const username = toSafeUsername(payload.username);
  if (!username) {
    sendJson(response, 400, { error: 'invalid username' });
    return;
  }

  const timeSeconds = toSafeTimeSeconds(payload.timeSeconds);
  if (!timeSeconds) {
    sendJson(response, 400, { error: 'invalid timeSeconds' });
    return;
  }

  const data = await ensureDataFile();
  const bucket = Array.isArray(data[difficulty]) ? data[difficulty].slice() : [];

  const entry = {
    username,
    difficulty,
    timeSeconds,
    recordedAt: new Date().toISOString()
  };

  bucket.push(entry);
  bucket.sort((a, b) => {
    if (a.timeSeconds !== b.timeSeconds) {
      return a.timeSeconds - b.timeSeconds;
    }
    return a.recordedAt.localeCompare(b.recordedAt);
  });

  const limitedBucket = bucket.slice(0, MAX_ENTRIES_PER_BOARD);
  data[difficulty] = limitedBucket;
  cache = data;
  await persistData();

  sendJson(response, 201, { entry });
};

const parseQuery = (searchParamsString) => {
  const query = {};
  if (!searchParamsString) {
    return query;
  }
  const params = new URLSearchParams(searchParamsString);
  params.forEach((value, key) => {
    query[key] = value;
  });
  return query;
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const { pathname, searchParams } = url;
  const query = parseQuery(searchParams.toString());

  if (request.method === 'GET' && pathname === '/api/leaderboard') {
    await handleGetLeaderboard(request, response, query);
    return;
  }

  if (request.method === 'POST' && pathname === '/api/leaderboard') {
    await handleSubmitLeaderboard(request, response);
    return;
  }

  response.statusCode = 404;
  response.end();
});

const PORT = Number.parseInt(process.env.PORT ?? '', 10) || 53123;

server.listen(PORT, () => {
  console.log(`Leaderboard API listening on port ${PORT}`);
});

const gracefulShutdown = async () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
