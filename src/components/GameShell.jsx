import React, { useContext } from "react";
import Toolbar from "./Toolbar.jsx";
import Board from "./Board.jsx";
import SelectionOverlay from "./SelectionOverlay.jsx";
import LeaderboardPanel from "./LeaderboardPanel.jsx";
import { GameContext } from "../context/GameContext.jsx";
import "../styles/board.css";

const statusLabel = (status) => {
  switch (status) {
    case "victory":
      return "游戏胜利";
    case "defeat":
      return "游戏失败";
    default:
      return "进行中";
  }
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
          <strong>计时</strong> {state.elapsedSeconds}s
        </span>
        <span
          className={`status-message${
            state.status === "victory" ? " status-message--victory" : ""
          }${state.status === "defeat" ? " status-message--defeat" : ""}`}
        >
          {statusLabel(state.status)}
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
