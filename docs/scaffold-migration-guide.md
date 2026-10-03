# 脚手架私有化与新项目创建指南

[English](./scaffold-migration-guide.en.md)

本文说明如何把当前 Next.js + Supabase 脚手架整理成团队自己的可复用模板，
以及如何从模板快速创建带有全新元信息、Supabase 配置和 Git 历史的项目。

推荐使用 [`scripts/create-project.sh`](../scripts/create-project.sh)。脚本始终生成到
新目录，不会原地删除当前仓库，也不会复制 `.git`、本地环境变量、依赖或构建缓存。

如果已经从模板仓库 clone 到目标目录，直接使用
[`scripts/setup-project.sh`](../scripts/setup-project.sh) 原地完成元信息、品牌、Supabase、
依赖、检查和 Git 配置。

## 0. Clone 后一键初始化

### 0.1 推荐：PAT + Project Ref 全自动配置

在 Supabase Account Tokens 创建 Personal Access Token，并从 Dashboard 或项目 URL 获取
20 位 Project Ref。然后执行：

```bash
git clone git@github.com:your-org/your-starter.git my-project
cd my-project

read -s SUPABASE_ACCESS_TOKEN
export SUPABASE_ACCESS_TOKEN

pnpm setup:project -- \
  --name my-project \
  --display-name "My Project" \
  --description "My Next.js and Supabase application." \
  --author "Your Team" \
  --repository "git@github.com:your-org/my-project.git" \
  --homepage "https://app.example.com" \
  --bugs-url "https://github.com/your-org/my-project/issues" \
  --brand-initials "M/P" \
  --supabase-project-ref abcdefghijklmnopqrst \
  --supabase-project-id my-project \
  --site-url "https://app.example.com" \
  --dev-port 3000 \
  --reset-git \
  --commit \
  --build

unset SUPABASE_ACCESS_TOKEN
```

脚本会一次完成：

1. 替换 `package.json`、`scaffold.config.json`、页面 metadata、品牌和文档中的模板名称。
2. 更新 `supabase/config.toml` 的本地项目 ID、Site URL 和开发回调端口。
3. 通过 Management API 获取 `publishable` key 并写入权限为 `0600` 的 `.env.local`。
4. 在托管 Supabase 启用 Email 和注册、要求确认邮箱、配置 6 位 OTP。
5. 配置生产、本地 `localhost` 和 `127.0.0.1` 的 confirm/callback URL。
6. 同步确认邮件和验证码邮件模板。
7. 安装锁文件依赖，并通过项目内置 Supabase CLI 执行 link。
8. 运行 `pnpm check`，传入 `--build` 时再运行生产构建。
9. 传入 `--reset-git` 时清除模板历史；传入 `--commit` 时创建新项目首次提交。

`SUPABASE_ACCESS_TOKEN` 不会写入项目。可选的数据库密码也只通过
`SUPABASE_DB_PASSWORD` 环境变量读取：

```bash
read -s SUPABASE_DB_PASSWORD
export SUPABASE_DB_PASSWORD
```

初始化后应执行 `unset SUPABASE_DB_PASSWORD`。不提供数据库密码时，CLI 仍可尝试 link，
但需要数据库连接的后续命令可能再次询问。

### 0.2 最小权限：只写本地 Supabase 配置

不希望 PAT 自动修改云端时，直接提供公开 URL 和 Publishable key：

```bash
pnpm setup:project -- \
  --name my-project \
  --display-name "My Project" \
  --supabase-url "https://your-project.supabase.co" \
  --supabase-publishable-key "sb_publishable_..." \
  --no-configure-supabase \
  --no-link-supabase
```

此模式只写 `.env.local` 和本地项目配置。Email Provider、Confirm email、URL 和邮件模板仍需
在 Dashboard 手动配置。

### 0.3 数据库迁移

初始化默认不执行数据库写操作。只有私有模板已包含经过审核的 `supabase/migrations/`，
并且希望立即部署时才增加：

```bash
--push-database
```

该参数要求成功 link，并执行 `supabase db push --linked --yes`。当前基础脚手架只有
`supabase/schema.sql` 设计清单，没有业务 migrations，因此无需使用。

完整参数：

```bash
./scripts/setup-project.sh --help
node scripts/configure-supabase.mjs --help
```

## 1. 先明确哪些内容可以替换

当前项目分为稳定基础设施和业务示例两部分。

### 应保留的稳定基础设施

| 路径 | 作用 | 迁移原则 |
| --- | --- | --- |
| `src/features/auth/` | 登录、注册、邮箱验证码、找回和重设密码 | 保留字段校验、提交状态、错误反馈和可访问性 |
| `src/lib/supabase/` | 浏览器、服务端和 Proxy Supabase 客户端 | 只使用公开 URL 与 Publishable key |
| `src/server/auth/` | 服务端用户读取、确认反馈和安全回跳 | 不绕过 `sanitizeRedirectPath` |
| `src/proxy.ts` | 会话刷新和 `/workspace` 路由保护 | 增加私有路由时同步更新 matcher |
| `src/app/auth/` | 邮箱确认和密码恢复回调 | 保留服务端验证与站内回跳限制 |
| `src/features/auth/auth-form-config.ts` | 认证字段规则和文案 | 新认证表单继续复用 |
| `supabase/templates/` | 本地确认邮件和验证码模板 | 云端模板仍需在 Dashboard 手动同步 |

### 应按业务替换的内容

| 路径 | 当前内容 | 需要做的修改 |
| --- | --- | --- |
| `src/app/page.tsx` | 脚手架能力首页 | 替换为产品首页或应用入口 |
| `src/app/workspace/page.tsx` | 登录后示例工作台 | 替换为真实业务页面，保留服务端身份校验 |
| `src/components/brand.tsx` | 默认名称与 `N/S` 标记 | 改为产品名称、简称和可访问名称 |
| `src/app/layout.tsx` | 默认 title 与 description | 改为产品 SEO 元信息 |
| `src/app/login/page.tsx` | 脚手架认证说明 | 可改外壳和品牌，不减少认证交互能力 |
| `src/app/terms/page.tsx` | 服务条款模板 | 补充运营主体、适用地区、联系方式和生效日期 |
| `src/app/privacy/page.tsx` | 隐私政策模板 | 补充真实处理目的、服务商、保存期限和用户权利 |
| `supabase/schema.sql` | 业务数据设计清单 | 加入表、约束、索引、RLS 和字段映射 |
| `README.md`、`README.en.md` | 脚手架说明 | 改为项目用途、部署方式和团队约定 |
| `AGENTS.md` | 脚手架工程边界 | 业务架构稳定后补充领域规则 |

## 2. 核心配置清单

### 必须修改

| 文件或平台 | 配置项 | 说明 |
| --- | --- | --- |
| `package.json` | `name` | 小写 npm 包名，可使用 `@scope/name` |
| `package.json` | `version` | 新项目通常从 `0.1.0` 开始 |
| `package.json` | `description` | 一句话说明项目用途 |
| `package.json` | `author` | 个人、团队或组织名称 |
| `package.json` | `repository` | 新仓库地址，不保留脚手架源仓库地址 |
| `package.json` | `homepage`、`bugs` | 产品主页和问题反馈地址，可选 |
| `package.json` | `license`、`private` | 私有项目建议 `UNLICENSED` 且保留 `private: true` |
| `scaffold.config.json` | 全部字段 | 供脚本识别当前模板品牌，并支持再次生成 |
| `supabase/config.toml` | `project_id` | 区分同一机器上的本地 Supabase 项目 |
| `supabase/config.toml` | `site_url`、回调 URL | 开发端口不为 3000 时必须同步修改 |
| `.env.local` | 两个公开 Supabase 变量 | 每个项目使用自己的 URL 和 Publishable key |
| Supabase Dashboard | Site URL、Redirect URLs | 托管项目不会自动读取 `config.toml` |

### 通常无需修改

- `tsconfig.json`、`biome.json`、`postcss.config.mjs` 和 `components.json` 已与当前
  工具链匹配。
- `next.config.ts` 中的安全响应头应保留。只有改变本地访问域名或部署约束时才修改
  `allowedDevOrigins`。
- `pnpm-workspace.yaml` 目前表示单包工作区。只有改为 monorepo 时才调整 `packages`。
- `.env.example` 应只保留变量名和说明，不写任何真实值。

## 3. 环境准备

### 必需工具

- Node.js 20 或更高版本，推荐使用当前 LTS。
- pnpm 11。仓库通过 `packageManager` 固定为 `pnpm@11.21.0`。
- Git。
- 一个新的 Supabase 项目。
- `rsync`。macOS 和大多数 Linux 发行版默认提供。

检查版本：

```bash
node --version
pnpm --version
git --version
rsync --version
```

使用 Corepack 安装仓库指定的 pnpm：

```bash
corepack enable
corepack prepare pnpm@11.21.0 --activate
```

如需运行本地 Supabase，还需要 Docker 和 Supabase CLI；只连接托管 Supabase 时不需要。

## 4. 推荐工作流

建议分成两个层级：

1. 从本仓库生成一个团队私有模板，例如 `acme-next-starter`。
2. 以后始终从私有模板生成具体业务项目，例如 `billing-console`。

生成后的项目仍包含脚本和 `scaffold.config.json`，所以可以继续作为上游模板使用。

### 第一次：创建团队私有模板

在当前脚手架根目录执行：

```bash
./scripts/create-project.sh \
  --name acme-next-starter \
  --display-name "Acme Next Starter" \
  --description "Acme 团队的 Next.js 与 Supabase 业务模板。" \
  --author "Acme Engineering" \
  --repository "git@github.com:acme/acme-next-starter.git" \
  --homepage "https://github.com/acme/acme-next-starter" \
  --bugs-url "https://github.com/acme/acme-next-starter/issues" \
  --brand-initials "A/S" \
  --supabase-project-id acme-next-starter \
  --no-install \
  --commit
```

`--commit` 需要本机已经配置 `git user.name` 和 `git user.email`。如果尚未配置，
去掉该参数，脚本仍会创建全新的空 Git 历史。

然后进入新目录，检查 README、法律页面、首页说明和 `AGENTS.md`，将组织约定固化到
私有模板中。推送前不要填入任何真实 Supabase 密钥。

### 日常：从私有模板创建业务项目

在私有模板根目录执行：

```bash
./scripts/create-project.sh \
  --name billing-console \
  --target ../billing-console \
  --display-name "Billing Console" \
  --description "内部账单审核与结算控制台。" \
  --author "Acme Finance Platform" \
  --repository "git@github.com:acme/billing-console.git" \
  --homepage "https://billing.example.com" \
  --bugs-url "https://github.com/acme/billing-console/issues" \
  --license UNLICENSED \
  --version 0.1.0 \
  --brand-initials "B/C" \
  --supabase-project-id billing-console \
  --dev-port 3000 \
  --install \
  --commit
```

也可以通过 pnpm 调用：

```bash
pnpm create:project -- \
  --name billing-console \
  --display-name "Billing Console" \
  --no-install
```

## 5. 脚本参数和行为

运行 `./scripts/create-project.sh --help` 可查看最新参数。

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `--name` | 无，必填 | 设置 npm 包名 |
| `--target` | `../<非 scope 包名>` | 设置目标目录 |
| `--display-name` | 包名 | 设置界面、README 和页面标题中的名称 |
| `--description` | 通用说明 | 设置 `package.json` 和根页面 description |
| `--author` | 空 | 设置作者；未提供时移除上游作者 |
| `--repository` | 空 | 设置 package repository，并作为 Git origin |
| `--homepage` | 空 | 设置项目主页 |
| `--bugs-url` | 空 | 设置问题反馈地址 |
| `--license` | `UNLICENSED` | 设置许可证 |
| `--version` | `0.1.0` | 设置初始版本 |
| `--brand-initials` | 从显示名称推导 | 设置短品牌标记 |
| `--supabase-project-id` | 非 scope 包名 | 设置本地 Supabase 项目 ID |
| `--dev-port` | `3000` | 修改本地 Site URL 和认证回调端口 |
| `--install` / `--no-install` | 安装 | 是否执行锁文件安装 |
| `--git` / `--no-git` | 初始化 | 是否创建全新 Git 仓库 |
| `--commit` | 不提交 | 是否创建首次提交 |

脚本会执行以下操作：

1. 校验 Node.js、包名、版本、端口、Supabase ID 和目标目录。
2. 使用临时目录复制源项目。
3. 排除旧 Git 历史、`.env*`、`node_modules`、Next.js 缓存、测试产物、
   编辑器状态和本地 Supabase 状态。
4. 保留 `.env.example`，并创建值为空的 `.env.local`。
5. 结构化更新 `package.json` 和 `scaffold.config.json`。
6. 更新页面品牌、根 metadata、README、样式指南和 `supabase/config.toml`。
7. 默认使用 `pnpm install --frozen-lockfile` 安装依赖。
8. 默认执行 `git init -b main`；提供仓库地址时添加 `origin`。

为防止覆盖文件，目标目录只要已经存在，脚本就会停止。脚本也拒绝在源目录内部生成，
避免递归复制。

## 6. 手动迁移方法

自动脚本不可用时，可按以下步骤手动完成。

### 6.1 创建不含本地状态的副本

```bash
rsync -a \
  --exclude='.git' \
  --exclude='.env*' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.next-dev' \
  --exclude='coverage' \
  --exclude='*.tsbuildinfo' \
  ./ ../my-project/

cp .env.example ../my-project/.env.example
cd ../my-project
cp .env.example .env.local
```

不要直接复制当前 `.env`。即使变量名相同，每个业务项目也应使用独立的 Supabase 项目。

### 6.2 清除原有提交历史

最安全的方法是像脚本一样根本不复制 `.git`。如果已经完整复制了仓库，只在确认当前目录
是新副本后执行：

```bash
rm -rf .git
git init -b main
git add .
git commit -m "chore: initialize project"
```

`rm -rf .git` 会永久移除该副本的提交、分支、标签、远端和 reflog，不要在唯一的源仓库中
执行。希望持续接收上游更新时，不要删除历史，改为保留源仓库：

```bash
git remote rename origin upstream
git remote add origin git@github.com:your-org/your-project.git
```

GitHub、GitLab 的 Template Repository 功能也会创建不继承提交历史的新仓库，适合团队托管。

### 6.3 修改项目元信息

编辑 `package.json`，至少确认：

```json
{
  "name": "my-project",
  "version": "0.1.0",
  "private": true,
  "description": "项目说明",
  "author": "Your Team",
  "license": "UNLICENSED",
  "repository": {
    "type": "git",
    "url": "git@github.com:your-org/my-project.git"
  },
  "homepage": "https://example.com",
  "bugs": {
    "url": "https://github.com/your-org/my-project/issues"
  }
}
```

同步修改 `scaffold.config.json`。这个文件不是运行时密钥，它记录脚本下一次替换品牌时所需的
当前值。手动修改界面后，也应确保其中的 `displayName` 和 `brandInitials` 与代码一致。

### 6.4 修改品牌和内容

依次检查：

```text
src/app/layout.tsx
src/components/brand.tsx
src/app/page.tsx
src/app/login/page.tsx
src/app/workspace/page.tsx
src/app/terms/page.tsx
src/app/privacy/page.tsx
README.md
README.en.md
docs/style-guide.md
docs/style-guide.en.md
```

脚本只替换名称、简称和根 description，不会替你编写产品文案、运营主体、法律条款或
业务页面。上线前必须人工审核这些内容。

### 6.5 配置 Supabase

1. 为新项目创建独立的 Supabase 项目。
2. 在 Project Settings 获取项目 URL 和 Publishable key。
3. 写入新项目的 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

4. 在 Authentication Providers 中启用 Email，并开启 Confirm email。
5. 在 URL Configuration 中设置：

```text
Site URL
http://localhost:3000

Redirect URLs
http://localhost:3000/auth/confirm
http://localhost:3000/auth/callback
https://your-domain.example/auth/confirm
https://your-domain.example/auth/callback
```

6. 按 `supabase/README.md` 同步 Confirm signup 和 Magic Link 邮件模板。
7. 生产环境配置自有 SMTP。
8. 新增业务表前，在 `supabase/schema.sql` 中明确字段、用户归属、约束、索引和 RLS。

仓库中的 `supabase/config.toml` 只控制 Supabase CLI 本地环境，不会自动修改云端项目。
生产 URL、邮件模板、SMTP 和 Provider 必须在 Dashboard 或受控部署流程中配置。

## 7. 依赖管理

迁移时保留 `pnpm-lock.yaml`，它固定经过验证的依赖解析结果。只修改名称、作者和仓库地址
不需要重建锁文件。

安装依赖：

```bash
pnpm install --frozen-lockfile
```

增加运行时依赖：

```bash
pnpm add package-name
```

增加开发依赖：

```bash
pnpm add -D package-name
```

移除依赖：

```bash
pnpm remove package-name
```

升级前先查看变化，并在升级后执行完整检查：

```bash
pnpm outdated
pnpm update --interactive
pnpm check
pnpm build
```

不要手工编辑 `pnpm-lock.yaml`，不要同时提交 npm 或 Yarn 锁文件。新增依赖前先确认现有
Next.js、Supabase、Tailwind、Base UI 或标准库不能合理完成需求。

## 8. 验证迁移结果

### 8.1 检查元信息和清理结果

```bash
node -e 'const p=require("./package.json"); console.log(p.name, p.description, p.repository)'
node -e 'console.log(require("./scaffold.config.json"))'
sed -n '1,12p' supabase/config.toml
git remote -v
git status --short
```

确认私密文件不会被提交：

```bash
git check-ignore .env.local
git status --ignored --short
```

`.env.local` 应显示为 ignored，`.env.example` 应正常受 Git 管理。新仓库的 `git log` 应为空，
或只包含脚本通过 `--commit` 创建的一次初始化提交。

### 8.2 安装、检查和构建

先填好 `.env.local`，然后执行：

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm dev
```

`pnpm check` 会依次运行 Biome、TypeScript 和 Vitest。浏览器打开
`http://localhost:3000`；使用其他端口时应与 `--dev-port`、Supabase URL 配置和启动命令
保持一致，例如 `pnpm dev -- --port 3100`。

### 8.3 功能验收

至少验证：

1. `/`、`/terms` 和 `/privacy` 可公开访问，品牌和文案已更新。
2. 未登录访问 `/workspace` 会跳转到 `/login?next=%2Fworkspace`。
3. 密码注册会发送确认邮件，确认后回到登录页。
4. 邮箱验证码为 6 位数字，60 秒内不能重复发送。
5. 密码登录、退出登录、找回密码和重设密码可用。
6. 登录后 `/workspace` 能在服务端读取当前用户。
7. 回跳参数不能跳转到站外 URL。
8. 生产域名的 Site URL、回调 URL 和邮件模板已在 Supabase Dashboard 生效。

## 9. 常见问题

### 脚本提示目标目录已存在

脚本不会覆盖已有目录。换一个 `--target`，或人工确认旧目录无用后自行处理。不要为了方便
给脚本增加无确认的强制覆盖。

### 包名校验失败

`--name` 必须是小写 npm 包名，例如 `billing-console` 或
`@acme/billing-console`。界面名称使用 `--display-name "Billing Console"`。

### `pnpm install --frozen-lockfile` 失败

先确认 pnpm 主版本与 `packageManager` 一致。如果有意修改了依赖，运行一次
`pnpm install` 更新锁文件，审核 `package.json` 和 `pnpm-lock.yaml` 的差异后再提交。

### 构建提示缺少 Supabase 配置

确认文件名是 `.env.local`，变量名严格为：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

修改后重启开发服务器。不要把 service role key 写入 `NEXT_PUBLIC_*` 变量。

### 邮件能发送，但确认或重设密码失败

检查 Supabase Dashboard 的 Site URL、Redirect URLs 和邮件模板。确认邮件必须使用
`TokenHash` 进入 `/auth/confirm`；密码恢复由 `/auth/callback` 交换 PKCE code。

### 邮箱收到的是链接而不是 6 位验证码

托管 Supabase 不会读取仓库模板。将 Dashboard 中 Magic Link 模板正文改为
`{{ .Token }}`，保存后重新发送验证码。

### 本地 Supabase 端口冲突

`supabase/config.toml` 中 API、数据库、Studio 和 SMTP 使用独立端口。多个项目同时运行时，
需要为冲突项目修改整组端口；`project_id` 不会自动解决端口占用。

### 新项目仍出现旧名称

先检查 `scaffold.config.json` 是否与源模板实际名称一致，再搜索：

```bash
rg -n "旧项目名|旧品牌简称" \
  src README.md README.en.md docs supabase package.json scaffold.config.json
```

脚本只自动处理当前仓库中已知的品牌文件。后续新增的业务文案和图片需要人工替换。

### 是否可以删除认证代码

可以替换认证页面的视觉外壳，但不应删除服务端用户校验、Proxy 会话刷新、安全回跳、
错误本地化、邮箱验证码冷却、表单可访问性和密码流程。完全更换认证方案时，应把它作为
独立架构迁移处理，而不是普通品牌替换。

## 10. 提交前清单

- [ ] 包名、显示名称、描述、作者、版本、许可证和仓库地址正确。
- [ ] `.git` 历史为空或只有新的初始化提交。
- [ ] `.env.local` 已被忽略，仓库中没有旧项目密钥和真实用户信息。
- [ ] Supabase 项目、Site URL、回调 URL、Email Provider 和邮件模板已配置。
- [ ] 首页、工作台、服务条款、隐私政策和 README 已按真实业务修改。
- [ ] 新业务表包含用户归属、约束、索引和 RLS。
- [ ] `pnpm install --frozen-lockfile`、`pnpm check` 和 `pnpm build` 全部通过。
- [ ] 注册、确认、登录、验证码、退出和密码恢复流程已人工验证。
