# AGENTS.md

本文面向在 LinguaFlow 视频学习助手仓库内工作的 AI Coding Agent。

## 项目边界

- `src/app/`：Next.js App Router 页面、布局、Route Handlers 和状态边界。
- `src/components/`：应用壳和跨功能共享组件。
- `src/components/ui/`：shadcn/ui 源码，优先组合现有组件。
- `src/features/`：认证、资源库、播放器、播放列表和设置交互。
- `src/lib/supabase/`：浏览器、服务端和 Proxy Supabase 客户端。
- `src/server/auth/`：服务端身份与认证回跳安全。
- `src/server/learning/`：业务查询、Server Actions 和视频链接解析。
- `src/types/`：Supabase 数据库类型和领域模型。
- `supabase/schema.sql`：业务表、索引、触发器、RLS 和 Storage 策略。
- `design-reference/`：原始视觉参考稿与素材，不参与应用构建和 Biome 检查。

## 工程规则

- 前端文件名使用全小写和连字符；函数使用小驼峰。
- TypeScript 保持严格类型，不引入 `any`。
- 格式和 lint 统一使用 Biome，不新增 ESLint。
- 优先使用 Server Component；只在交互或浏览器 API 需要时使用客户端组件。
- 写操作必须使用 Server Action，并在服务端重新读取认证用户。
- 不信任客户端传入的 `user_id`、Storage 路径或资源归属。
- 新增表必须同时补充外键、索引、RLS、数据库类型和 README。
- 不写入真实密钥、用户数据、数据库密码或 service role key。

## 认证规则

- 登录、注册、邮箱验证码、邮箱确认、密码恢复和重设属于稳定基础设施。
- 私有路径由 `src/proxy.ts` 刷新会话并保护，页面仍需服务端二次校验。
- 所有回跳地址必须经过 `sanitizeRedirectPath`。
- 开发和生产环境都必须提供 Supabase 公共配置，不使用本地样例数据回退。

## UI 规则

- 颜色和圆角使用 `src/app/globals.css` 中的语义令牌。
- 业务界面保持安静、可扫描和高信息密度，不使用营销式首屏。
- 图标统一使用 Lucide；纯图标按钮必须有可访问名称和 Tooltip。
- 表单使用 `FieldGroup`、`Field`、`FieldLabel` 和 shadcn 输入组件。
- 弹窗和抽屉必须包含可访问的 Title 和 Description。
- 桌面和移动端都要检查溢出、遮挡、断行和触控目标。

## 验证

```bash
pnpm check
pnpm build
```

涉及数据库时还应检查：

```bash
pnpm exec supabase db lint
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
