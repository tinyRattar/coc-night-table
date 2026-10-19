# GitHub Pages + Supabase

正式前端：https://tinyrattar.github.io/coc-night-table/

后端项目：`wuhgpugfbbkjvzvkhpdf`。本次使用新数据库，不导入 Sites 旧房间和素材。
请创建新房间并重新分享邀请。旧 Sites 仍保留，但与新版数据独立。

## 结构与权限

`app/` 保留界面、规则与 API；`server/supabase/` 适配 Postgres 与私有 Storage。
`standalone/` 是完整 React 浏览器入口，`vite.pages.config.ts` 构建 Pages。
Sites 原有构建入口保留用于过渡，不由此工作流部署。

所有业务表启用 RLS，并撤销 `anon` 和 `authenticated` 的直接访问权限。
浏览器只调用 `table` Edge Function，后端验证房间会话、KP 权限、可见性和版本。
`verify_jwt=false` 是因为使用应用自身的调查员会话，受保护接口仍检查身份。
会话为随机 256 位令牌，数据库只存摘要，7 天到期；修改密码撤销旧会话。
浏览器 localStorage 保存会话，通过 `x-coc-session` 请求头发送，附件读取同样验证身份。
数据库密码、service-role key、部署 token 均不进入前端。
密码为空的调查员允许持房间链接的人登录；KP 可自行设置密码。

每个请求使用数据库事务，写请求锁定对应房间；结算仍检查战斗/人物卡版本。
素材桶保持私有，文件读取每次验证当前身份和开放状态。
同步继续使用原有 2.5 秒轮询，暂不额外引入 Realtime。

## 自动部署

仓库 Actions Secret `SUPABASE_ACCESS_TOKEN`：有权部署此项目的 Supabase token。
不需要提供数据库密码。推送 `main` 或手动运行 `Deploy full application`：

1. 类型检查、规则测试、构建 Edge Function。
2. 管理 API 应用未执行的迁移，并记录包含文件校验和的迁移名称。
3. 部署后端并运行多人、权限、战斗、文件端到端测试。
4. 测试成功后构建完整前端并发布 Pages。

脚本不重置数据库，已应用的迁移不可修改，请新增迁移文件。
管理 API 为迁移分配版本号，以迁移名称校验对应的仓库文件；不要混用 `supabase db push`。
不要同时开启 Supabase GitHub integration 的生产部署，避免重复执行两套迁移流程。
自动预览分支不是必需条件。
集成测试创建独立“迁移验证”房间，不触碰真实房间；测试图片成功验证后删除。

## 开发

Node.js 24，`npm ci`。本地 `.env.local`（不提交）：

```text
VITE_COC_API_URL=https://wuhgpugfbbkjvzvkhpdf.supabase.co/functions/v1/table
```

`npm run dev:pages` 启动完整界面。`npm run build:pages` 输出 `dist/pages`。
`npm run build:supabase` 生成 `supabase/functions/table/index.ts`，请勿手改生成文件。
`npm run test:rules` 检查规则，`COC_API_URL=... npm run test:supabase` 验证已部署后端。

Edge Function 使用平台提供的 `SUPABASE_DB_URL`、`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。
`COC_ALLOWED_ORIGINS` 可覆盖逗号分隔的前端来源白名单，默认当前 Pages 和本地开发。
更换项目时更新 CI 项目 ID、API 地址及来源白名单。
