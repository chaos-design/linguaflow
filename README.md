# LinguaFlow 视频学习助手

[English](./README.en.md)

一个基于 Next.js App Router、shadcn/ui 与 Supabase 的个人视频学习工作台。
它把视频资源、断点续看、时间戳笔记、播放列表和学习统计集中到同一个账户中。

## 文档

- [用户使用手册](./docs/user-guide.md)：安装、账户、视频学习、生词复习、常见问题和注意事项。
- [Vercel 部署指南](./docs/vercel-deployment.md)：环境变量、构建、分支、触发、排错和回滚。
- [Supabase 配置](./supabase/README.md)：数据库、认证、RLS 和本地开发。
- [界面规范](./docs/style-guide.md)：视觉令牌、组件状态和响应式约束。
- [内置词库数据来源](./docs/vocabulary-data-sources.md)：B1、B2/雅思 6 分、C1
  与常用词组的范围、许可和生成方式。

## 核心能力

- 完整邮箱认证：注册、邮箱验证、密码登录、邮箱验证码登录、找回和重设密码。
- 视频资源库：本地文件、链接导入、分类、默认标签，以及来源、字幕和进度组合筛选。本地视频只保存浏览器文件句柄，不上传视频内容。
- 链接解析：校验公网地址并读取 YouTube、Bilibili、Vimeo 公开元数据与可用字幕，解析阶段不会上传视频或创建资源记录。
- 解析缓存：有效字幕保存到用户自己的 Supabase 解析缓存，后续默认复用；重新解析需要确认，并只更新同源记录。
- 自动进度：播放器定期保存观看位置，支持断点续看和完成状态。
- 时间戳笔记：在当前播放位置添加、编辑、删除和跳转笔记。
- 字幕学习：链接入库时自动解析平台公开字幕，也可用 SRT / WebVTT 覆盖；译文默认隐藏，仅在字幕进入可视区后按需翻译并保存到 Supabase。
- 生词与复习：支持 B1、B2/雅思 6 分、C1 和常用词组内置词库，支持单词、
  词组和短语的在线词典查询、手动添加与 CSV/TSV 批量导入，以及内置词库来源配置、
  导入标签配置、标签重命名、批量添加标签、多选筛选、英美音标、多个例句、批量管理、
  新词排期和艾宾浩斯到期队列。
- 数据导出：生词本 CSV 备份和 Anki TSV 卡片。
- 播放列表：按课程、目标或阶段组织学习内容，支持单个移除和批量删除。
- 学习统计：累计时长、完成视频、笔记数量、连续学习、最近 7 天活动和 20 周学习日历。
- 响应式界面：桌面侧栏、移动抽屉、浅色/深色/系统主题。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript
- Tailwind CSS 4、shadcn/ui、Lucide
- Supabase Auth、Postgres、Storage、Row Level Security
- Biome、Vitest、pnpm

## 环境要求

- Node.js 20 或更高版本
- pnpm 11
- 一个 Supabase 项目
- 最新版 Chrome 或 Edge，用于持久授权本地视频文件
- 可选：Docker Desktop，用于本地运行 Supabase

## 本地运行

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 [http://localhost:5566](http://localhost:5566)。

开发和生产环境都直接读取 Supabase 中由导入、解析和学习操作产生的数据，不提供样例数据回退。

## 环境变量

项目遵循最小配置原则，只需要两个公开变量；使用自定义 AI 接口时可额外配置服务端域名白名单：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
AI_ALLOWED_HOSTS=gateway.example.com
```

前两个变量可以在 Supabase Dashboard 的 `Project Settings > API` 中获取。不要把
`.env.local`、访问令牌、数据库密码或 service role key 提交到仓库。
`AI_ALLOWED_HOSTS` 使用英文逗号分隔精确域名；OpenAI、Anthropic 和 Agnes AI
官方域名已内置。

## Supabase 初始化

### 托管项目

`supabase/platform.sql` 会创建业务表、索引、触发器和 RLS 策略。
新项目应在 Supabase SQL Editor 中完整执行该文件；已有项目先备份，再审核并执行
`supabase/updated.sql`。当前仓库不保存可由 `supabase db push` 直接发布的版本化
migration，不要把数据库变更放入 Vercel 构建命令。所有业务数据都通过
`auth.uid()` 限制为当前用户所有。数据库注册触发器还会拒绝非常用邮箱后缀，避免绕过
前端表单直接注册。

在 `Authentication > URL Configuration` 中配置：

- Site URL：本地使用 `http://localhost:5566`，生产使用正式域名。
- Redirect URLs：加入 `/auth/callback` 和 `/auth/confirm` 的本地及生产完整地址。
- Email Provider：开启邮箱注册和 Confirm email。

邮件模板可参考 `supabase/templates/`。远端项目不会自动读取本地模板，需要在 Dashboard
同步配置。

### 本地 Supabase

```bash
pnpm supabase:start
pnpm supabase:status
pnpm dev
```

把 `supabase:status` 输出的 API URL 与 publishable/anon key 写入 `.env.local`。
本地邮件可在 Inbucket 中查看，默认地址为 `http://127.0.0.1:54324`。

## 数据模型

主要表包括：

- `profiles`、`categories`、`tags`、`videos`、`video_parse_cache`、`video_tags`
- `video_progress`、`notes`、`transcript_cues`
- `vocabulary_words`、`vocabulary_tags`、`review_logs`
- `playlists`、`playlist_items`
- `study_sessions`

本地视频文件句柄保存在当前浏览器的 IndexedDB，文件内容不写入 Supabase；
Supabase 仅保存标题、分类、标签、字幕、笔记和学习进度。账户默认视频标签保存在
`profiles.preferences`，资源库字幕状态由 `transcript_cues` 的只读摘要生成。
`transcript_cues.translation_language` 标记按需翻译的目标语言；
`vocabulary_words` 分别保存英美音标、词性、英文/中文释义、例句、词源构词信息与
可选的 AI 双语解析，`vocabulary_tags` 关联用户标签用于归类和筛选。AI 的启用状态、
提供商、接口类型、接口地址、模型名和 API 密钥
全部保存在当前浏览器的 localStorage，不会写入 Supabase；数据库中的 AI 解析结果也
不包含模型配置元数据。

公开视频解析结果按稳定 `source_key` 写入 `video_parse_cache`，不会把远程视频上传到
Storage，也不会在解析阶段创建 `videos` 记录。用户确认入库时，同一用户的同源视频只会
更新原记录；字幕优先使用已存缓存，明确选择重新解析后才再次请求视频平台。

公开视频元数据和英文释义分别使用平台公开接口与 FreeDictionaryAPI.com，不需要额外密钥。
词汇深度解析是可选能力，需要在设置页配置兼容 OpenAI Chat Completions 的模型。
当前版本不内置音频转写服务；无字幕视频需要手动导入 SRT 或 WebVTT，界面不会模拟
ASR 结果。

## 常用命令

```bash
pnpm dev             # 开发服务器
pnpm lint            # Biome 检查
pnpm lint:fix        # Biome 自动修复
pnpm typecheck       # TypeScript 检查
pnpm test            # Vitest
pnpm check           # lint + typecheck + test
pnpm build           # 生产构建
pnpm validate:deployment-env # 校验部署所需环境变量
pnpm vercel:build     # Vercel 完整质量检查与生产构建
```

## 项目结构

```text
src/
  app/                 App Router 页面、布局和错误状态
  components/          应用壳和 shadcn/ui 组件
  features/            认证、资源库、播放器、播放列表和设置交互
  lib/                 Supabase 客户端、格式化和通用工具
  server/              服务端认证、查询和写操作
  types/               数据库与领域类型
supabase/
  platform.sql         完整数据库、索引和 RLS 配置
  updated.sql          已有项目的增量更新
  templates/           邮箱认证模板
design-reference/      原始静态视觉参考稿与素材
```

## 部署

项目通过 `vercel.json` 固定使用 Next.js、`pnpm install --frozen-lockfile` 和
`pnpm vercel:build`。构建会先校验环境变量，再执行 Biome、TypeScript、Vitest 和
Next.js 生产构建。

部署前需要：

1. 为 Preview 和 Production 配置各自的两个 `NEXT_PUBLIC_SUPABASE_*` 变量。
2. 单独应用并验证 Supabase SQL，不在 Vercel 构建中修改数据库。
3. 在 Supabase 中配置生产域名、Preview 域名和认证回调允许列表。
4. 将 `main` 设为 Production Branch，并在合并前验收 Preview Deployment。
5. 发布后访问 `/api/health`，再执行注册、登录、读取和写入冒烟测试。

完整流程、触发条件、错误处理和回滚命令见
[Vercel 部署指南](./docs/vercel-deployment.md)。

生产上线前应替换并审核服务条款、隐私政策、运营主体和邮件发送配置。
