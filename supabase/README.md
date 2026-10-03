# Supabase 配置

[English](./README.en.md)

本目录包含 LinguaFlow 的 Auth、Postgres、Storage 和本地开发配置。

## 初始化

`platform.sql` 会创建业务表、索引、更新时间触发器和 RLS 策略，SQL 可重复执行。
新项目应在 Supabase Dashboard 的 SQL Editor 中完整执行该文件。

如果现有项目已经执行过旧版结构，应先备份，再审核并执行 `updated.sql`。该文件集中包含视频
解析缓存表及其 RLS、本地视频来源类型、字幕译文目标语言、生词词性与词典元数据字段、
生词标签关联表、可持久化的 AI 双语解析字段、注册邮箱后缀限制，以及 `profiles` RLS
策略和历史用户 profile 回填修复。
脚本末尾会通知 PostgREST 刷新 schema cache。

当前仓库不包含 `supabase/migrations/`，因此 `supabase db push` 不会应用上述 SQL。
数据库发布必须与 Vercel 构建分离，具体顺序见
[Vercel 部署指南](../docs/vercel-deployment.md)。

业务表覆盖视频、解析缓存、进度、笔记、字幕时间轴、生词、生词标签关联、
艾宾浩斯复习记录、播放列表和学习会话。
`profiles.preferences` 保存账户级学习偏好。字幕和生词表均按 `user_id` 启用 RLS，
关联视频的写入策略还会校验视频所有权。
账户默认视频标签保存在 `profiles.preferences`，资源库字幕状态由
`transcript_cues` 的只读摘要生成。
本地视频文件句柄保存在浏览器 IndexedDB，Supabase 只保存本地资源键和学习元数据。
字幕译文通过 `translation_language` 记录目标语言；生词表分别保存英美音标、词性、
英文/中文释义、例句、词源构词信息和 AI 双语解析，`vocabulary_tags` 复用用户标签并
通过 RLS 同时校验标签和生词所有权。AI 的启用状态、提供商、接口类型、接口地址、
模型名和 API 密钥全部保存在用户当前浏览器的 localStorage，不写入
Supabase，AI 解析结果也不保存模型配置元数据。`updated.sql` 会清理历史偏好和解析
结果中的配置字段，并添加白名单约束防止再次写入。学习日历由
`study_sessions`、`review_logs` 和 `notes` 按日期聚合生成。

`video_parse_cache` 按 `(user_id, source_key)` 唯一保存公开视频元数据与有效字幕。
解析阶段不会创建 `videos` 记录或上传远程视频；确认入库后，`videos.source_key`
保证同源视频更新原记录而不是重复创建。

## 认证

在 Supabase Dashboard 中：

1. 开启 Email Provider、邮箱注册和 Confirm email。
2. 设置 Site URL。
3. 把本地和生产环境的 `/auth/callback`、`/auth/confirm` 完整地址加入 Redirect URLs。
4. 按 `templates/` 同步确认邮件和验证码邮件模板。

`platform.sql` 和 `updated.sql` 会在 `auth.users` 写入前校验邮箱域名，因此该限制无法通过
直接调用公开 Auth API 绕过。现有账户不受影响。

本地配置默认使用 `http://localhost:5566`，邮件可在
`http://127.0.0.1:54324` 查看。

## 安全边界

- 浏览器和 Next.js 服务端会话客户端只使用 publishable key。
- 所有业务表都启用 RLS，并使用 `auth.uid()` 限制数据所有者。
- 新导入的本地视频不会写入 Storage；历史 Storage 记录仍按原有 RLS 规则只读兼容。
- 每次 Server Action 都重新读取认证用户，不信任客户端传入的 `user_id`。
- 项目不需要 service role key。
