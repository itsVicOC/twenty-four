# 24 点竞技场

一个静态部署的 24 点速算竞技网页：Vite + React + TypeScript、shadcn/ui 风格组件、Supabase Postgres/RPC 裁判、GitHub Pages 部署。

## 本地开发

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
cp .env.example .env.local
```

3. 启动：

```bash
npm run dev
```

没有 Supabase 环境变量时，页面会进入本地练习模式；配置后可参加每日正式赛并读取排行榜。

## Supabase 设置

1. 新建 Supabase 项目并启用 Auth 的 Anonymous sign-ins。
2. 在 SQL Editor 按文件名顺序运行 `supabase/migrations/` 下的 SQL。
3. 前端只需要 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。

正式赛公平性由数据库提供：

- `start_daily_run` 使用 Asia/Shanghai 日期创建每日固定题组。
- `restart_daily_run` 可清空本人今日正式赛进度并重新计时。
- `submit_solution` 只接受 3 步运算轨迹，并用有理数精确验算。
- `runs.started_at`、`completed_at` 和 `score_ms` 都由数据库时间生成。
- 今日榜只展示已完成成绩，历史榜按每日名次积分累计。

## GitHub Pages 部署

1. 仓库 Settings -> Pages -> Source 选择 GitHub Actions。
2. 添加仓库 Secrets：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 默认部署路径是 `/twenty-four/`。如果仓库名不同，添加仓库 Variable `VITE_BASE_PATH`。
4. 推送到 `main` 后工作流会构建并部署 `dist`。

## 验证

```bash
npm run lint
npm run test
npm run build
```

Supabase 合约测试文件在 `supabase/tests/rpc_contract.sql`，可在本地 Supabase/pgTAP 环境中运行。
