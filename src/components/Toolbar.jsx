import React, { useContext, useEffect, useMemo, useState } from "react";
import { GameContext } from "../context/GameContext.jsx";

const Toolbar = () => {
  const { state, actions } = useContext(GameContext);
  const [customRows, setCustomRows] = useState("16");
  const [customColumns, setCustomColumns] = useState("16");
  const [customMines, setCustomMines] = useState("40");
  const [customError, setCustomError] = useState("");

  const handleDifficultyChange = (event) => {
    const nextDifficulty = event.target.value;
    actions.changeDifficulty(nextDifficulty);
    if (nextDifficulty !== "custom") {
      setCustomError("");
    }
  };

  useEffect(() => {
    if (!state.rows || !state.columns || !state.mines) {
      return;
    }
    setCustomRows(String(state.rows));
    setCustomColumns(String(state.columns));
    setCustomMines(String(state.mines));
  }, [state.rows, state.columns, state.mines]);

  const difficultyOptions = useMemo(
    () => [...state.difficultyPresets, { id: "custom", label: "自定义" }],
    [state.difficultyPresets]
  );

  const maxMinesAllowed = useMemo(() => {
    const rowsValue = Number.parseInt(customRows, 10);
    const columnsValue = Number.parseInt(customColumns, 10);
    if (Number.isNaN(rowsValue) || Number.isNaN(columnsValue)) {
      return null;
    }
    const totalCells = rowsValue * columnsValue;
    if (totalCells < 3) {
      return null;
    }
    return Math.max(1, totalCells - 2);
  }, [customRows, customColumns]);

  const handleCustomSubmit = async (event) => {
    event.preventDefault();

    const rowsValue = Number.parseInt(customRows, 10);
    const columnsValue = Number.parseInt(customColumns, 10);
    const minesValue = Number.parseInt(customMines, 10);

    if (
      Number.isNaN(rowsValue) ||
      Number.isNaN(columnsValue) ||
      Number.isNaN(minesValue)
    ) {
      setCustomError("请在所有字段中输入数字。");
      return;
    }

    if (rowsValue < 2 || rowsValue > 50) {
      setCustomError("行数必须介于 2 到 50 之间。");
      return;
    }

    if (columnsValue < 2 || columnsValue > 50) {
      setCustomError("列数必须介于 2 到 50 之间。");
      return;
    }

    const maxMines = rowsValue * columnsValue - 2;
    if (maxMines < 1 || minesValue < 1 || minesValue > maxMines) {
      setCustomError(`地雷数量必须介于 1 和 ${Math.max(1, maxMines)} 之间。`);
      return;
    }

    setCustomError("");
    await actions.applyCustomConfig({
      rows: rowsValue,
      columns: columnsValue,
      mines: minesValue,
    });
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <select
          value={state.difficulty}
          onChange={handleDifficultyChange}
          aria-label="选择难度"
        >
          {difficultyOptions.map((preset) => (
            <option value={preset.id} key={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => actions.resetGame()}>
          新的游戏
        </button>
      </div>
      <div className="toolbar-group">
        <label>
          <input
            type="checkbox"
            checked={state.autoMarkEnabled}
            onChange={actions.toggleAutoMark}
          />
          自动框选标记
        </label>
      </div>
      {state.difficulty === "custom" && (
        <div className="toolbar-group">
          <form className="custom-config" onSubmit={handleCustomSubmit}>
            <label>
              行数
              <input
                type="number"
                min="2"
                max="50"
                value={customRows}
                onChange={(event) => setCustomRows(event.target.value)}
              />
            </label>
            <label>
              列数
              <input
                type="number"
                min="2"
                max="50"
                value={customColumns}
                onChange={(event) => setCustomColumns(event.target.value)}
              />
            </label>
            <label>
              地雷
              <input
                type="number"
                min="1"
                max={maxMinesAllowed ?? undefined}
                value={customMines}
                onChange={(event) => setCustomMines(event.target.value)}
              />
            </label>
            <button type="submit">应用设置</button>
          </form>
          {maxMinesAllowed !== null && (
            <span className="custom-config__hint">
              可用地雷数量范围：1 - {maxMinesAllowed}
            </span>
          )}
          {customError && (
            <span className="status-message status-message--defeat">
              {customError}
            </span>
          )}
        </div>
      )}
      {state.error && (
        <span className="status-message status-message--defeat">
          {state.error}
        </span>
      )}
    </div>
  );
};

export default Toolbar;
