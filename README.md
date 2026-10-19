# 秘典 · CoC 多人调查桌

面向《克苏鲁的呼唤》第七版的中文多人跑团工具。React / TypeScript + Vinext，服务端运行于 Cloudflare Workers，使用 D1 保存房间与角色，R2 保存素材。

## 功能

- 导入 CoC Excel、JSON、CSV、TXT、ST 人物卡；属性、技能、武器及状态编辑。
- 房间邀请、调查员身份登录（密码默认可空）、KP 身份与跨设备恢复。
- 普通 / 困难 / 极难检定、奖惩骰、自由骰；KP 代掷及暗骰。
- HP / SAN 上限与进度条，固定数值或骰子损伤治疗，公开变化记录。
- 战斗轮、NPC 与临时武器、闪避 / 反击、手枪连射、伤害结算。
- KP 上传并开放文字、图片、PDF，玩家回看已开放素材。
- 紧凑记录、类型筛选、最近使用技能排序和可调整列数。

这是辅助工具，部分战斗及疯狂状态仍需 KP 裁定。规则实现与限制见界面说明及测试。项目不包含官方规则书、怪物资料库或用户上传的素材。

## 本地运行

要求 Node.js 24（至少 22.13）及 npm。Windows、macOS、Linux 均可；初次安装需要联网。

```sh
git clone https://github.com/tinyRattar/coc-night-table.git
cd coc-night-table
npm ci
npm run db:local
npm run dev
```

访问终端打印的地址，默认 `http://127.0.0.1:5173/`。创建新调查员与房间后即可测试；本地数据库和文件存储在被忽略的 `.wrangler/` 中。`db:local` 仅迁移本地数据库，可重复运行，已应用的迁移会跳过。

本项目的角色身份使用自己的房间登录接口，不要求 ChatGPT 账号。保留的 Sites 开发模板具有独立的模拟登录能力，它不等于应用内 KP 权限。

## 检查与测试

```sh
npm run typecheck
npm run build
node tests/game.test.mjs
```

规则单测使用 Node.js 24 的 TypeScript 支持。端到端接口测试需要先启动开发服务器：

```sh
node tests/vitals.mjs
node tests/keeper.mjs
node tests/combat-multiplayer.mjs
node tests/identity.mjs
node tests/materials.mjs
```

这些接口测试会创建测试房间及数据。默认目标为本机；不要把 `COC_TEST_ORIGIN` 指向生产站点，除非明确打算写入测试数据。Excel 样例卡属于用户文件，不包含在仓库内；相关导入测试需要自行准备对应夹具。

## 目录

| 路径 | 用途 |
| --- | --- |
| `app/page.tsx` | 主工作台 |
| `app/api/` | 身份、检定、战斗与素材 API |
| `app/game.ts`、`app/encounters.ts`、`app/combat.ts` | 规则计算 |
| `app/vital-*`、`app/compact-history.tsx` | 状态管理及紧凑记录 |
| `db/schema.ts`、`drizzle/` | 数据库结构与迁移 |
| `tests/` | 规则及多人接口测试 |
| `build/`、`scripts/` | Sites / Cloudflare 构建与开发支持 |

## 协作与部署

通过分支和 Pull Request 协作，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。本仓库从当前线上源码快照建立，不包含部署凭证、生产数据库、房间邀请链接或历史提交中的本地信息。

当前线上版本仍通过 Sites 发布；向 GitHub 推送不会自动部署。维护者确认 PR 后，将变更同步到 Sites 工作区，再完成构建与发布。新建 Sites 实例时，由 Sites 工具设置该实例的 `project_id`；仓库的 `.openai/hosting.json` 仅保留 D1/R2 声明。底层模板说明见 [docs/SITES-STARTER.md](docs/SITES-STARTER.md)。独立 Cloudflare 部署还需配置自己的 D1、R2 与 Worker，不能直接使用原站点资源。

## 数据与访问

密码为空时，持有房间链接的人可以选择该身份（包括 KP）。需要身份保护时请设置密码。暗骰、未开放素材和玩家人物卡在服务端检查访问权限。提交代码时请特别保留权限校验和人物卡版本冲突保护。

不要提交 `.env*`、`.dev.vars*`、`.wrangler/`、数据库文件、真实人物卡或私人素材。

## 授权说明

仓库公开用于查看和协作，尚未为项目原创代码指定开源许可证。若需要在其他项目中再分发或使用，请先与维护者确认授权。第三方代码保留各自许可证，例如 `build/sites-vite-plugin.LICENSE` 和 `vendor/` 内的许可文件。
