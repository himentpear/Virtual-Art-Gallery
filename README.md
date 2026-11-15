# 栽培与剪枝：程序化生成到算法美学

**Cultivation & Pruning: From Procedural Generation to Algorithmic Aesthetics**

《视觉艺术与计算美学》2026 互动计算艺术展览线上多人虚拟展厅与交互应用平台。本项目将程序化生成与状态空间搜索（BFS）从电子游戏内部机制转化为可观看、可体验、可参与的互动展览，让观众在像素虚拟美术馆中经历 **参观 → 游玩 → 发现规则 → 设计关卡 → 算法验证 → 发布作品 → 社区评价** 的完整过程。

---

## 核心展品与展览单元

### 预展核心作品
- **《咔哒！全体出发》**：多主体同步控制益智游戏。以统一指令驱动多个机器人，呈现全局指令与局部状态差异、复杂状态空间与程序化关卡生成。
- **《啪嗒！影子剧院》**：空间投影与连锁消除益智游戏。通过移动纸偶演员与调整投影方向触发连锁反应，结合 BFS 状态空间搜索与解法验证。

### 四大主题单元
1. **第一单元 · 播种（规则的起点）**：《咔哒！全体出发》《啪嗒！影子剧院》互动试玩、规则说明与预览屏幕。
2. **第二单元 · 修剪（机器寻找答案）**：《可能性之树》搜索可视化与《算法剪枝台》自动验证及最短解求解。
3. **第三单元 · 栽培（人人都是创作者）**：《关卡栽培台》（自由创作 / 程序辅助创作）与《关卡种子档案》可复现数字档案。
4. **第四单元 · 开花（玩家与社区）**：《公共关卡花园》社区挑战评分与《共同生长的美术馆》实时数据生成艺术景观。

### 线上展厅空间分区
- **种子大厅**：访客登记、形象定制、电子通行证签发与 Credit 导览
- **机械苗圃**：《咔哒！全体出发》展示与试玩区
- **修剪实验室**：BFS 搜索可视化、关卡编辑器与自动验证系统
- **影子温室 / 公共花园**：《啪嗒！影子剧院》展示区、玩家关卡与社区评价档案

---

## 技术栈与目录结构

- **前端展厅**：PixiJS + PixelSyn 像素角色系统 + TypeScript + Vite（`src/`）
- **边缘服务与实时房间**：Cloudflare Workers + Durable Objects（WebSocket Hibernation API + SQLite）+ Workers Static Assets（`worker/`）
- **自动化流水线**：GitHub Actions 自动类型检查、构建与 Cloudflare 部署（`.github/workflows/deploy.yml`）

```text
├── src/
│   ├── character/     # 像素角色控制与换装缩略图
│   ├── interaction/   # 展厅热点交互管理
│   ├── scene/         # 横板像素展厅场景与展品画框
│   └── ui/            # 访客登记、电子通行证、幻装衣橱与 HUD
├── worker/
│   ├── index.ts       # Worker 路由入口（/api/*, /ws/room, ASSETS）
│   └── GalleryRoomDO.ts # 多人同屏房间 Durable Object
├── wrangler.jsonc     # Cloudflare Workers 与 Durable Objects 配置
└── .github/workflows/ # GitHub Actions CI/CD 工作流
```

---

## 本地开发

```bash
# 安装依赖
npm install

# 仅前端 Vite 热更新开发
npm run dev

# 构建前端并启动 Cloudflare Worker + Durable Objects 本地模拟
npm run dev:worker

# 类型检查（前端 + Worker）
npm run typecheck
```

本地 Worker 接口（启动 `npm run dev:worker` 后）：
- `GET /api/health` — Worker 健康检查
- `GET /api/room/stats?room=main-hall-1` — 查询房间在线人数与玩家列表（DO RPC）
- `WS  /ws/room?room=main-hall-1` — 加入展厅房间 WebSocket（支持 `join` / `move` / `wardrobe` / `chat` / `ping`）

---

## GitHub Actions 自动部署配置

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中添加以下 Secrets：

1. `CLOUDFLARE_API_TOKEN`：具有 **Edit Cloudflare Workers** 权限的 API Token
2. `CLOUDFLARE_ACCOUNT_ID`：你的 Cloudflare Account ID

推送代码至 `main` 分支后，GitHub Actions 会自动执行类型检查、前端构建并部署到 Cloudflare Workers。
