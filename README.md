# 苍穹回廊 · Astral Gallery

基于 PixiJS + PixelSyn 的正视像素展厅与多人同屏互动平台，使用 **Cloudflare Workers + Durable Objects + Workers Static Assets** 托管。

## 目录结构

- `src/` — 前端展厅场景、角色控制器、换装与访客登记 UI（Vite + TypeScript）
- `worker/` — Cloudflare Worker 入口（`worker/index.ts`）与多人房间 Durable Object（`worker/GalleryRoomDO.ts`）
- `wrangler.jsonc` — Cloudflare Workers、Static Assets 与 Durable Objects SQLite 迁移配置
- `.github/workflows/deploy.yml` — GitHub Actions 自动类型检查、构建与 Cloudflare 部署流水线

## 本地开发

```bash
# 安装依赖
npm install

# 仅前端 Vite 热更新开发
npm run dev

# 构建前端并启动 Cloudflare Worker + Durable Objects 本地模拟
npm run dev:worker
```

常用接口（启动 `dev:worker` 后）：
- `GET /api/health` — Worker 健康检查
- `GET /api/room/stats?room=main-hall-1` — 查询房间在线人数与玩家列表（DO RPC）
- `WS  /ws/room?room=main-hall-1` — 加入展厅房间 WebSocket（支持 `join` / `move` / `wardrobe` / `chat` / `ping`）

## GitHub Actions 自动部署配置

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

1. `CLOUDFLARE_API_TOKEN`：具有 **Edit Cloudflare Workers** 权限的 API Token
2. `CLOUDFLARE_ACCOUNT_ID`：你的 Cloudflare Account ID

推送代码至 `main` 分支后，GitHub Actions 会自动执行类型检查、前端构建并部署到 Cloudflare Workers。
