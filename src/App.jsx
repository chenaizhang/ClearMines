import React from "react";
import { GameProvider } from "./context/GameContext.jsx";
import GameShell from "./components/GameShell.jsx";

const App = () => {
  return (
    <GameProvider>
      <div className="app-frame">
        <header className="app-header">
          <h1>扫雷</h1>
          <p>一款界面优美的离线扫雷游戏</p>
        </header>
        <GameShell />
      </div>
    </GameProvider>
  );
};

export default App;
