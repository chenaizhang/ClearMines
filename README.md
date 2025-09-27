# ClearMines 项目部署指南

本项目包含一个 React 前端（通过 Vite 启动）以及一个采用 Node 原生 `http` 模块实现的排行榜服务。排行榜服务会将每个难度的前 100 名成绩持久化到 `server/data/leaderboard.json`，前端则通过 `/api` 代理获取前 10 名数据并提交成绩。

## 环境要求

- Node.js 18 或更高版本（自带 npm）
- Git（克隆代码用）

> 如果你已经安装了 Node.js，则可以通过 `node -v` 与 `npm -v` 命令确认版本。

## 获取代码

```bash
git clone https://example.com/ClearMines.git
cd ClearMines
npm install
```

## 部署排行榜服务

排行榜服务默认监听 `53123` 端口，可通过设置 `PORT` 环境变量修改。以下步骤分别针对不同平台。

### macOS / Linux

1. 安装 Node.js（推荐使用 [Node.js 官网安装包](https://nodejs.org/) 或 Homebrew：`brew install node`）。
2. 打开终端进入项目目录，执行 `npm install`。
3. 运行服务器：
   ```bash
   npm run server
   ```
   - 如需指定端口：`PORT=50000 npm run server`
4. 首次运行时会自动创建 `server/data/leaderboard.json` 文件。

### Windows (PowerShell)

1. 从 [Node.js 官网](https://nodejs.org/) 下载并安装 Windows 安装包（确保勾选 npm）。
2. 打开 PowerShell，进入项目目录并执行 `npm install`。
3. 运行服务器：
   ```powershell
   npm run server
   ```
   - 指定端口时：`set PORT=50000; npm run server`
4. 数据文件会生成在 `server\data\leaderboard.json`。

## 启动前端

无论在哪个平台，需在另一个终端/PowerShell 窗口中执行：

```bash
npm run dev
```

Vite 默认监听 `http://localhost:5173`，同时会通过代理将 `/api` 请求转发到排行榜服务（端口需与上一步保持一致）。

## 验证部署

1. 保证排行榜服务和前端同时运行。
2. 打开浏览器访问 `http://localhost:5173`。
3. 完成一局游戏后，锁定用户名并胜利即可触发成绩提交。
4. 刷新页面，确认排行榜展示的是服务器端（前 10 名）的数据。

## 常用命令

- `npm run server`：启动排行榜服务。
- `PORT=50000 npm run server`：在指定端口运行排行榜服务。
- `npm run dev`：启动前端开发服务器。
- `npm run build`：打包前端资源。

## 故障排查

- **前端提示 ECONNREFUSED**：确认排行榜服务是否已启动，端口是否与 `vite.config.js` 中的代理目标一致。
- **排行榜数据丢失**：检查 `server/data/leaderboard.json` 是否存在或具有写权限。
- **端口冲突**：修改 `PORT` 环境变量后重启排行榜服务，并同步更新 `vite.config.js` 中的代理配置（或在运行前端前设置 `VITE_API_URL` 之类的自定义代理逻辑）。

## 生产部署提示

- 可将排行榜服务部署到常见 Node 托管平台（如 pm2、systemd、Docker 等），并确保开放对应端口。
- 前端可使用 `npm run build` 生成静态资源，再由任意静态服务器托管，同时将 `/api` 指向排行榜服务。

如需进一步自定义部署方案（例如 HTTPS、反向代理或数据库存储），可以在现有 `server/index.js` 基础上扩展。
