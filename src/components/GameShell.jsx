import React, { useContext } from "react";
import Toolbar from "./Toolbar.jsx";
import Board from "./Board.jsx";
import SelectionOverlay from "./SelectionOverlay.jsx";
import LeaderboardPanel from "./LeaderboardPanel.jsx";
import { GameContext } from "../context/GameContext.jsx";
import "../styles/board.css";

const statusLabel = ({ status, timerActive, elapsedSeconds } = {}) => {
  if (status === "victory") {
    return "游戏胜利";
  }
  if (status === "defeat") {
    return "游戏失败";
  }
  if (status === "loading") {
    return "加载中";
  }
  if (status === "error") {
    return "加载失败";
  }
  if (!timerActive && elapsedSeconds === 0) {
    return "请开局";
  }
  return "进行中";
};

const GameShell = () => {
  const { state } = useContext(GameContext);

  return (
    <div className="game-shell">
      <Toolbar />
      <div className="info-banner">
        <span>
          <strong>炸弹数</strong> {state.flagsRemaining}
        </span>
        <span>
          <strong>计时</strong> {((state.elapsedMs ?? state.elapsedSeconds * 1000) / 1000).toFixed(2)}s
        </span>
        <span
          className={`status-message${
            state.status === "victory" ? " status-message--victory" : ""
          }${state.status === "defeat" ? " status-message--defeat" : ""}`}
        >
          {statusLabel(state)}
        </span>
      </div>
      <div className="board-scroll-container">
        <div className="board-wrapper">
          <Board />
          <SelectionOverlay />
        </div>
      </div>
      <LeaderboardPanel />
    </div>
  );
};

export default GameShell;
