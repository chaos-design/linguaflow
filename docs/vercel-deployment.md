# LinguaFlow Vercel 部署指南

本文面向项目维护者，说明 LinguaFlow 在 Vercel 上的部署、验证、故障处理和回滚流程。

## 1. 部署边界

LinguaFlow 由两个独立部分组成：

- Vercel：运行 Next.js 页面、Route Handler、Proxy 和 Server Action。
- Supabase：提供 Auth、Postgres、Storage 和 Row Level Security。

Vercel 构建不会自动修改 Supabase 数据库。数据库结构必须先由维护者审核并单独应用，
避免 Preview 部署或重复构建误改生产数据。

仓库中的部署相关文件：

| 文件 | 作用 |
| --- | --- |
| `vercel.json` | 固定框架、依赖安装命令和构建命令 |
| `.vercelignore` | 排除 Vercel CLI 部署路径上的本地构建产物与机器相关文件 |
| `scripts/validate-deployment-env.mjs` | 构建前校验必需环境变量，并拦截误用 secret/service role key |
| `src/app/api/health/route.ts` | 发布后基础存活检查，不返回环境变量内容 |
| `supabase/platform.sql` | 新 Supabase 项目的完整数据库结构 |
| `supabase/updated.sql` | 已有项目的增量更新脚本 |

补充说明：

- Git 集成部署只上传已提交文件，因此 `.gitignore` 天然生效。
- `vercel deploy` CLI **不读取** `.gitignore`，只用 Vercel 内置忽略列表加 `.vercelignore`。
  本项目的 `next dev` 把 `distDir` 设为 `.next-dev`，而 Vercel 内置列表只包含 `.next`，
  因此 `.next-dev`（约 167 MB）必须由 `.vercelignore` 显式排除，否则每次 CLI 部署都会
  上传本地开发构建产物。

## 2. 前置条件

- Git 仓库已推送到 Vercel 支持的 Git 提供商。
- Vercel 账户有该仓库的读取权限。
- 已创建 Supabase 项目，并取得 Project URL 和 publishable key。
- 本地使用 Node.js 22.12 及以上和 pnpm 11；版本由 `package.json` 的 `engines` 固定。
  下限为 22.12 是因为 Vitest 依赖 `require(esm)`，该能力在 22.12 之前不可用。
  Vercel 只提供 major 版本，`engines` 声明的区间会解析到最新的 22.x，因此生产不受影响。
- 生产域名、运营主体、支持渠道、隐私政策和服务条款已经确定。

建议 Preview 与 Production 使用不同的 Supabase 项目。这样预览测试不会访问生产用户
和生产学习数据。

## 3. 分支策略

推荐使用以下策略：

| 分支 | Vercel 环境 | 用途 |
| --- | --- | --- |
| `main` | Production | 仅接收已审核且已通过检查的合并 |
| `feature/*`、`fix/*` | Preview | 功能开发、缺陷修复和产品验收 |
| `develop`（可选） | Preview 或自定义 Staging | 多分支持续集成 |

在 Vercel `Project Settings > Git` 中将 Production Branch 设为 `main`。在 Git 提供商中
保护 `main`，要求 Pull Request、构建检查和至少一次审核后才能合并。

数据库变更应保持向后兼容：先增加表、列或策略并验证，再部署使用新结构的应用。删除列、
收紧约束等破坏性变更应放到后续独立发布中，确保旧 Vercel 部署仍可回滚。

## 4. 环境变量

在 Vercel `Project Settings > Environment Variables` 中配置：

| 变量 | 必需 | 环境 | 说明 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Preview、Production | Supabase Project URL，例如 `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 是 | Preview、Production | Supabase publishable key；旧项目也可使用公开 anon key |
| `AI_ALLOWED_HOSTS` | 否 | Preview、Production | 自定义 AI 接口的精确域名白名单，多个域名使用英文逗号分隔 |

注意：

- `NEXT_PUBLIC_*` 会进入浏览器构建产物，只能填写公开客户端配置。
- 禁止填写 `sb_secret_*`、service role key、数据库密码或个人访问令牌。
- `SUPABASE_ACCESS_TOKEN` 和数据库连接串只用于维护者本地或受保护的数据库 CI，不应加入
  Vercel 前端项目。
- AI 启用状态、提供商、接口类型、接口地址、模型名和 API 密钥全部保存在当前浏览器
  `localStorage`，不会写入 Supabase；只有自定义接口域名白名单属于 Vercel 环境变量。
- 修改 Vercel 环境变量后，已有部署不会自动重建；必须重新部署目标 commit。

仓库的构建前校验会在以下情况直接终止发布：

- 必需变量为空或仍是明显的占位值。
- Supabase URL 不是有效的 HTTP(S) URL。
- Vercel 环境中的 Supabase URL 未使用 HTTPS。
- publishable key 中误填了 Supabase secret key 或 JWT service role key。

## 5. Supabase 上线准备

### 5.1 应用数据库结构

新项目：

1. 打开 Supabase Dashboard 的 SQL Editor。
2. 完整执行 `supabase/platform.sql`。
3. 确认所有业务表已启用 RLS，且 `videos` Storage bucket 已创建。

已有项目：

1. 先创建数据库备份或确认 Point-in-Time Recovery 可用。
2. 审核并执行 `supabase/updated.sql`。
3. 检查脚本输出，并确认 PostgREST schema cache 已刷新。

当前仓库不保存可由 `supabase db push` 直接发布的版本化 migration，因此不要把
`pnpm supabase:db:push` 放入 Vercel Build Command。需要自动化数据库发布时，应先建立
独立、可审查且只在受保护生产流水线运行的 migration 流程。

### 5.2 配置认证地址

在 Supabase `Authentication > URL Configuration` 中设置：

- Site URL：生产正式域名，例如 `https://learn.example.com`。
- Redirect URL：`https://learn.example.com/auth/callback`。
- Redirect URL：`https://learn.example.com/auth/confirm`。
- 本地开发：`http://localhost:5566/auth/callback` 和
  `http://localhost:5566/auth/confirm`。

如需在 Preview 环境测试邮箱确认或密码重设，再加入：

```text
https://*-<vercel-team-or-account-slug>.vercel.app/**
```

生产地址使用精确路径，通配符只用于受控的 Preview 域名。同步
`supabase/templates/` 中的邮件模板，并确认 Email Provider、邮箱注册和
Confirm email 已开启。

## 6. 首次部署

1. 在 Vercel Dashboard 中选择 `Add New > Project` 并导入仓库。
2. 将 Framework Preset 设为 `Next.js`，Root Directory 保持仓库根目录 `.`。
3. 添加 Preview 和 Production 对应的两个 Supabase 环境变量。
4. 确认 Production Branch 为 `main`。
5. 先完成 Supabase 数据库和认证配置，再触发 Deploy。
6. 等待 `pnpm vercel:build` 全部通过。
7. 绑定生产域名；如域名发生变化，同步更新 Supabase Site URL 和 Redirect URLs。
8. 完成发布后检查。

也可以使用 Vercel CLI：

```bash
pnpm dlx vercel@latest link
pnpm dlx vercel@latest env pull .env.local
pnpm vercel:build
pnpm dlx vercel@latest deploy
pnpm dlx vercel@latest deploy --prod
```

CLI 路径不受 `.gitignore` 保护，`.vercelignore` 必须在仓库中已存在才会生效，因此首次
link 后不要删除该文件。

首次发布建议先执行 Preview 命令，验收通过后再部署 Production。

## 7. 构建命令

`vercel.json` 已固定以下设置，Dashboard 中不要再配置互相冲突的覆盖值：

```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm vercel:build"
}
```

构建顺序：

1. `pnpm install --frozen-lockfile`：严格按 `pnpm-lock.yaml` 安装依赖。
2. `pnpm validate:deployment-env`：检查 Supabase 公共配置。
3. `pnpm build`：生成 Next.js 生产构建。

任一步返回非零状态码，Vercel 都会把本次部署标记为失败。失败构建不会替换当前正常的
Production Deployment。

Biome、TypeScript 和 Vitest **不在构建命令中运行**，由 `.github/workflows/ci.yml`
在 PR 和 `main` 推送时作为质量门禁执行。原因是 Vercel 会向源码目录写入一份平台生成的
`vercel.json`，`biome check .` 会把这份非仓库文件判为格式错误从而阻塞部署；该问题与
代码质量无关，也不应影响生产发布。`biome.json` 同时显式排除 `vercel.json`。

### 运行时限制

以下为按当前代码实测的结论，用于判断是否需要额外配置：

| 限制 | 平台数值 | 本项目现状 |
| --- | --- | --- |
| 函数最大执行时长 | Fluid compute 下默认 300 秒（Hobby、Pro、Enterprise 一致）；Pro 及以上可上调至 800 秒 | AI 词汇分析单次请求上限 45 秒，AI 连通性验证上限 20 秒，均在默认时长内 |
| 请求与响应体上限 | 4.5 MB | 字幕与词汇导入为文本载荷，当前无接近上限的路径 |
| 函数产物体积 | 250 MB | `.next/server` 约 34 MB |

批量链接解析使用 `Promise.allSettled` 并发执行，单次最多 50 个链接，墙钟时长接近单次解析
的 8 秒超时而非累加，因此同样在默认时长内。

结论：当前无需声明 `maxDuration`。若后续引入更长的同步任务，请按 Next.js 规则在**页面
层级**导出 `maxDuration`（Server Action 不在 `"use server"` 文件上设置），并同步确认目标
套餐的上限。

Vercel 默认在 `iad1`（美东）运行函数。若主要用户在国内，需评估函数到 Supabase 与视频
平台的往返延迟；Hobby 套餐只能使用 `iad1`，调整区域需要 Pro 及以上。

## 8. 部署触发条件

连接 Git 后，Vercel 默认按以下规则触发：

- Pull Request 创建或更新：创建新的 Preview Deployment。
- 非生产分支 push：创建或更新该分支的 Preview Deployment。
- commit 合并或 push 到 `main`：创建 Production Deployment。
- Vercel Dashboard 中点击 Redeploy：重新构建选定部署。
- 执行 `vercel deploy`：手动创建 Preview Deployment。
- 执行 `vercel deploy --prod`：手动创建 Production Deployment。

同一分支连续 push 时，Vercel 会优先构建最新 commit，并可能取消尚未开始的旧构建。
环境变量或 Supabase 配置变化本身不会自动触发部署。当前项目未配置 Ignored Build
Step，因此包括文档变更在内的每次 Git push 都会触发对应环境的构建。

## 8.1 质量门禁

`.github/workflows/ci.yml` 在 Pull Request 和 `main` 推送时运行 `pnpm check`，即 Biome、
TypeScript 和 Vitest。该工作流**不部署**，只负责在合并前拦截失败。Vercel 构建不重复执行
这些检查，原因见第 7 节。

冷安装约 3 分 30 秒，完整校验约 2 分钟，工作流超时设为 15 分钟。CI 产物不用于部署，
因此不需要设置 `NEXT_PUBLIC_*` 环境变量。

启用 `main` 分支保护时，把 `Lint, typecheck and test` 设为必需检查。
需注意：GitHub 的必需检查以 job 名称匹配，改动 `ci.yml` 中的 `name:` 会使已有保护规则
失效，需要同步更新。

## 9. 发布后检查

至少检查以下项目：

```bash
curl --fail --silent --show-error https://<deployment-domain>/api/health
```

正常响应：

```json
{
  "service": "linguaflow",
  "status": "ok"
}
```

该端点只确认 Next.js 函数可运行且 Supabase 公共配置存在，不执行数据库读写。继续进行
以下人工冒烟测试：

1. 首页、登录页和 `/api/health` 返回正常。
2. 新用户可以收到确认邮件，确认后可以登录。
3. 已有用户可以登录、退出并找回密码。
4. 工作台可读取数据，RLS 不会返回跨用户记录。
5. 导入一个公开视频链接，并打开播放器。
6. 添加一条笔记或测试生词收藏，再确认数据刷新后仍存在。
7. 在目标浏览器和移动端检查关键页面。

## 10. 错误处理

### 10.1 构建失败

按构建日志中最先失败的阶段处理：

| 阶段 | 常见原因 | 处理 |
| --- | --- | --- |
| Install | lockfile 与 `package.json` 不一致、包源不可用 | 本地执行 `pnpm install`，提交更新后的 lockfile |
| Environment validation | 变量缺失、URL 无效、误用高权限 key | 修正目标环境变量后 Redeploy |
| Biome / TypeScript / Vitest | 代码质量、类型或测试失败 | 本地运行 `pnpm check`，修复后重新 push |
| Next.js build | 路由、服务端渲染或依赖构建错误 | 本地运行 `pnpm build` 并查看完整堆栈 |

不要通过移除检查命令规避失败。先修复根因，再重新部署原 commit 或新 commit。

### 10.2 运行时错误

1. 请求 `/api/health`，区分整体部署故障和业务数据故障。
2. 在 Vercel `Logs` 中按 Deployment、状态码和时间范围筛选。
3. 核对当前部署绑定的环境变量环境，不要在日志或 Issue 中粘贴完整 key。
4. 检查 Supabase Auth Logs、Postgres Logs、RLS 策略和服务状态。
5. 对视频平台、词典或翻译服务失败，确认目标资源公开可访问，并检查第三方限流或超时。
6. 工作区读取失败时，界面会显示可重试错误状态；重复失败应按上述日志继续定位。

## 11. 回滚方案

### 11.1 Vercel 应用回滚

发生严重生产故障时，先恢复服务，再调查根因：

```bash
vercel logs --environment production --status-code 5xx --since 30m
vercel list --prod
vercel rollback <last-known-good-deployment-url-or-id>
vercel rollback status
vercel logs --environment production --status-code 5xx --since 5m
```

也可以在 Vercel Dashboard 的 Deployments 页面选择上一个已验证部署并执行 Rollback。
回滚在路由层切换到旧部署，不需要重新构建。若要将已验证的 Preview 直接设为生产，可用：

```bash
vercel promote <deployment-url>
vercel promote status
```

### 11.2 数据库回滚

Vercel 回滚不会回滚 Supabase。数据库变更应优先采用向前修复：

1. 停止继续发布并备份受影响数据。
2. 评估旧应用与当前数据库结构是否兼容。
3. 优先追加修复 SQL；涉及删列、删表或数据重写时先导出数据。
4. 在非生产项目验证 SQL 和 RLS 后再应用到生产。
5. 完成后重新执行登录、查询、写入和跨用户隔离测试。

不要在未备份的情况下直接回滚破坏性 DDL。

## 12. 发布检查表

- [ ] `main` 已启用分支保护和必需检查。
- [ ] Preview 与 Production 使用正确的 Supabase 项目。
- [ ] 两个公开环境变量已配置到目标环境。
- [ ] 未向 Vercel 添加 service role key、数据库密码或访问令牌。
- [ ] 数据库 SQL 已审核、备份并单独应用。
- [ ] Supabase Site URL、Redirect URLs 和邮件模板已更新。
- [ ] CI 的 `Lint, typecheck and test` 已通过。
- [ ] `pnpm vercel:build` 在本地通过。
- [ ] Preview 已完成核心流程验收。
- [ ] `/api/health` 与生产冒烟测试通过。
- [ ] 已记录最后一个正常部署 URL，回滚人员具备权限。
- [ ] 服务条款、隐私政策、运营主体和联系方式已替换为生产内容。

## 13. 参考资料

- [Vercel 项目配置](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel Git 部署](https://vercel.com/docs/git)
- [Vercel 生产回滚](https://vercel.com/docs/deployments/rollback-production-deployment)
- [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
