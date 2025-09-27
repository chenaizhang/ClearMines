const neighborOffsets = [-1, 0, 1];

const DEFAULT_CONFIG = { rows: 16, columns: 16, mines: 40 };
const MIN_ROWS = 2;
const MAX_ROWS = 50;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 50;

let currentGame = null;

const clampConfig = (config = {}) => {
  const rows = Math.min(Math.max(Math.trunc(config.rows ?? DEFAULT_CONFIG.rows), MIN_ROWS), MAX_ROWS);
  const columns = Math.min(
    Math.max(Math.trunc(config.columns ?? DEFAULT_CONFIG.columns), MIN_COLUMNS),
    MAX_COLUMNS
  );
  const totalCells = rows * columns;
  const maxMines = Math.max(1, totalCells - 1);
  const mines = Math.min(Math.max(Math.trunc(config.mines ?? DEFAULT_CONFIG.mines), 1), maxMines);
  return { rows, columns, mines };
};

const createEmptyBoard = (rows, columns) => {
  const board = new Array(rows);
  for (let row = 0; row < rows; row += 1) {
    board[row] = new Array(columns);
    for (let column = 0; column < columns; column += 1) {
      board[row][column] = {
        row,
        column,
        state: 'hidden',
        isMine: false,
        adjacentMines: 0,
        exploded: false
      };
    }
  }
  return board;
};

const serializeCell = (cell) => ({
  row: cell.row,
  column: cell.column,
  state: cell.state,
  isMine: cell.isMine,
  adjacentMines: cell.adjacentMines,
  exploded: cell.exploded
});

const listCells = (board) => {
  const cells = [];
  board.forEach((row) => {
    row.forEach((cell) => cells.push(serializeCell(cell)));
  });
  return cells;
};

const forEachNeighbor = (board, cell, callback) => {
  neighborOffsets.forEach((dRow) => {
    neighborOffsets.forEach((dCol) => {
      if (dRow === 0 && dCol === 0) {
        return;
      }
      const row = cell.row + dRow;
      const column = cell.column + dCol;
      if (row < 0 || column < 0 || row >= board.length || column >= board[0].length) {
        return;
      }
      callback(board[row][column]);
    });
  });
};

const computeAdjacentCounts = (board) => {
  board.forEach((row) => {
    row.forEach((cell) => {
      let count = 0;
      forEachNeighbor(board, cell, (neighbor) => {
        if (neighbor.isMine) {
          count += 1;
        }
      });
      cell.adjacentMines = count;
    });
  });
};

const placeMines = (board, rows, columns, mines, safeCell) => {
  const taken = new Set();
  const forbiddenKey = safeCell ? `${safeCell.row}:${safeCell.column}` : null;
  let placed = 0;

  while (placed < mines) {
    const row = Math.floor(Math.random() * rows);
    const column = Math.floor(Math.random() * columns);
    const key = `${row}:${column}`;
    if (taken.has(key) || key === forbiddenKey) {
      continue;
    }
    taken.add(key);
    board[row][column].isMine = true;
    placed += 1;
  }
};

const createGame = (config, safeCell) => {
  const { rows, columns, mines } = clampConfig(config);
  const board = createEmptyBoard(rows, columns);
  placeMines(board, rows, columns, mines, safeCell);
  computeAdjacentCounts(board);

  return {
    rows,
    columns,
    mines,
    board,
    flagsRemaining: mines,
    status: 'playing',
    revealedSafeCells: 0,
    totalSafeCells: rows * columns - mines,
    started: false
  };
};

const ensureGame = () => {
  if (!currentGame) {
    currentGame = createGame(DEFAULT_CONFIG);
  }
  return currentGame;
};

const snapshotGame = (game) => ({
  rows: game.rows,
  columns: game.columns,
  mines: game.mines,
  flagsRemaining: game.flagsRemaining,
  status: game.status,
  cells: listCells(game.board)
});

const revealNeighborsIfZero = (game, cell, updated) => {
  const queue = [cell];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    const key = `${current.row}:${current.column}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    if (current.state === 'flagged') {
      continue;
    }

    if (current.state !== 'revealed') {
      current.state = 'revealed';
      if (!current.isMine) {
        game.revealedSafeCells += 1;
      }
      updated.push(serializeCell(current));
    }

    if (current.adjacentMines !== 0) {
      continue;
    }

    forEachNeighbor(game.board, current, (neighbor) => {
      if (neighbor.state === 'hidden' && !neighbor.isMine) {
        queue.push(neighbor);
      }
    });
  }
};

const revealAllMines = (game, triggerCell, updated) => {
  const victoryMode = !triggerCell && game.status === 'victory';
  game.board.forEach((row) => {
    row.forEach((cell) => {
      if (!cell.isMine) {
        return;
      }
      const wasFlagged = cell.state === 'flagged';
      if (victoryMode && wasFlagged) {
        return;
      }
      cell.state = 'revealed';
      cell.exploded = triggerCell ? cell === triggerCell : false;
      if (!wasFlagged || cell.exploded) {
        updated.push(serializeCell(cell));
      }
    });
  });
};

const checkVictory = (game) => {
  if (game.revealedSafeCells >= game.totalSafeCells) {
    game.status = 'victory';
    game.flagsRemaining = 0;
  }
};

export const loadSnapshot = async () => {
  const game = ensureGame();
  return snapshotGame(game);
};

export const resetGame = async (config) => {
  currentGame = createGame(config ?? DEFAULT_CONFIG);
  return snapshotGame(currentGame);
};

export const revealCell = async ({ row, column }) => {
  const game = ensureGame();
  if (game.status !== 'playing') {
    return { updatedCells: [], flagsRemaining: game.flagsRemaining, status: game.status };
  }

  let cell = game.board[row]?.[column];
  if (!cell) {
    throw new Error('无效的位置');
  }

  if (!game.started) {
    if (cell.isMine) {
      currentGame = createGame({ rows: game.rows, columns: game.columns, mines: game.mines }, cell);
      return revealCell({ row, column });
    }
    game.started = true;
  }

  if (cell.state === 'flagged' || cell.state === 'revealed') {
    return { updatedCells: [], flagsRemaining: game.flagsRemaining, status: game.status };
  }

  const updatedCells = [];

  if (cell.isMine) {
    cell.state = 'revealed';
    cell.exploded = true;
    updatedCells.push(serializeCell(cell));
    game.status = 'defeat';
    revealAllMines(game, cell, updatedCells);
    return { updatedCells, flagsRemaining: game.flagsRemaining, status: game.status };
  }

  revealNeighborsIfZero(game, cell, updatedCells);
  checkVictory(game);

  if (game.status === 'victory') {
    revealAllMines(game, null, updatedCells);
  }

  return { updatedCells, flagsRemaining: game.flagsRemaining, status: game.status };
};

export const flagCell = async ({ row, column }) => {
  const game = ensureGame();
  const cell = game.board[row]?.[column];

  if (game.status !== 'playing') {
    return { updatedCell: cell ? serializeCell(cell) : null, flagsRemaining: game.flagsRemaining, status: game.status };
  }

  if (!cell || cell.state === 'revealed') {
    return { updatedCell: cell ? serializeCell(cell) : null, flagsRemaining: game.flagsRemaining, status: game.status };
  }

  if (cell.state === 'hidden') {
    if (game.flagsRemaining <= 0) {
      return { updatedCell: serializeCell(cell), flagsRemaining: game.flagsRemaining, status: game.status };
    }
    cell.state = 'flagged';
    game.flagsRemaining -= 1;
  } else if (cell.state === 'flagged') {
    cell.state = 'hidden';
    game.flagsRemaining += 1;
  }

  return { updatedCell: serializeCell(cell), flagsRemaining: game.flagsRemaining, status: game.status };
};

const autoFlagFromCell = (game, cell, flaggedCells) => {
  if (cell.state !== 'revealed' || cell.adjacentMines <= 0) {
    return;
  }

  const hiddenNeighbors = [];
  let flaggedNeighborCount = 0;
  forEachNeighbor(game.board, cell, (neighbor) => {
    if (neighbor.state === 'flagged') {
      flaggedNeighborCount += 1;
    } else if (neighbor.state === 'hidden') {
      hiddenNeighbors.push(neighbor);
    }
  });

  const remainingMines = cell.adjacentMines - flaggedNeighborCount;
  if (remainingMines <= 0 || hiddenNeighbors.length !== remainingMines) {
    return;
  }

  hiddenNeighbors.forEach((neighbor) => {
    const key = `${neighbor.row}:${neighbor.column}`;
    if (flaggedCells.has(key) || game.flagsRemaining <= 0) {
      return;
    }
    neighbor.state = 'flagged';
    game.flagsRemaining -= 1;
    flaggedCells.set(key, serializeCell(neighbor));
  });
};

export const autoMarkSelection = async ({ rowBegin, rowEnd, colBegin, colEnd }) => {
  const game = ensureGame();
  if (game.status !== 'playing') {
    return { flaggedCells: [], flagsRemaining: game.flagsRemaining, status: game.status };
  }

  const boundedRowBegin = Math.max(0, Math.min(rowBegin, rowEnd));
  const boundedRowEnd = Math.min(game.rows - 1, Math.max(rowBegin, rowEnd));
  const boundedColBegin = Math.max(0, Math.min(colBegin, colEnd));
  const boundedColEnd = Math.min(game.columns - 1, Math.max(colBegin, colEnd));

  const flaggedCells = new Map();

  for (let row = boundedRowBegin; row <= boundedRowEnd; row += 1) {
    for (let column = boundedColBegin; column <= boundedColEnd; column += 1) {
      const cell = game.board[row][column];
      autoFlagFromCell(game, cell, flaggedCells);
    }
  }

  return {
    flaggedCells: Array.from(flaggedCells.values()),
    flagsRemaining: game.flagsRemaining,
    status: game.status
  };
};

export const getCurrentGame = () => currentGame;
