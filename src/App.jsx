import React from "react";
import { GameProvider } from "./context/GameContext.jsx";
import GameShell from "./components/GameShell.jsx";

const App = () => {
  return (
    <GameProvider>
      <div className="app-frame">
        <header className="app-header">
          <div className="app-title">
            <img className="app-logo" src="/image/logo.png" alt="ClearMines logo" />
            <h1>ClearMines</h1>
          </div>
          <p>一款基于 React 的离线扫雷游戏</p>
        </header>
        <GameShell />
      </div>
    </GameProvider>
  );
};

export default App;
