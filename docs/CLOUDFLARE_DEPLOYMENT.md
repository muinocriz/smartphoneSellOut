# Cloudflare Workers 与 GitHub Pages 部署

## Cloudflare Workers

Cloudflare 从公开仓库的 `master` 分支部署 `smartphonesellout`。构建命令为 `npm run build`，部署命令为 `npx wrangler deploy`。静态资源目录为 `dist/`，发布文件由 `studio-assets.mjs` 列出。

三个模块及其已发布数据均允许匿名访问。热销机型与榜单研究模块在生产环境使用 `/studio/`，同目录包含榜单历史、研究脚本及构建生成的销量面板。市场份额模块的页面已下线，市场份额 CSV 和解析器仍保留根路径及 `/studio/` 副本，供热销机型与榜单研究模块研究使用；旧版销量追踪模块已下线，根路径通过轻量 index.html 跳转销量增量追踪模块，保留 data.csv 供销量数据处理模块导入。本地开发直接从仓库根目录读取文件。


### 初始化 D1

Worker 的 `DB` 绑定在 `wrangler.jsonc` 中维护。初始化前，在最新的 `master` 检出目录中确认四份源 CSV 是要导入的版本。以下命令需要 Python 3 和同一 Cloudflare 账户的 Wrangler 授权：

```sh
npx wrangler login
python3 scripts/prepare-d1-seed.py --output ../smartphone-sales-initial.sql
npx wrangler d1 migrations apply DB --remote
npx wrangler d1 execute DB --remote --file ../smartphone-sales-initial.sql
```

初始 SQL 只用于空业务表，生成文件放在仓库外。导入后在 D1 控制台核对六张业务表的行数与脚本输出。若导入报错，先核对目标库及已有记录，再决定如何恢复。初始化完成后，Cloudflare 正式站可以从 D1 读取数据。


### 核对 D1 只读接口

部署后，在 Cloudflare 主站打开 `/api/counts`，将六张表的 `row_count` 与初始导入脚本打印的各表行数比较。若返回 503，查看该 Worker 的部署、D1 绑定和日志。

`/api/models`、`/api/tracking`、`/api/rankings` 和 `/api/market-share` 以 `{ "data": [...] }` 返回已公开数据。接口仅接受 GET，销量与份额的十进制文本保留原精度，未披露的份额返回 null。这些 API 仅由 Cloudflare Worker 提供。Cloudflare 三个页面通过这些接口读取正式数据。GitHub Pages 和本地静态预览继续读取构建产物或仓库中的 CSV。Cloudflare 读取失败时显示错误，保留现有会话编辑。

## GitHub Pages

仓库 Pages 的发布来源选择 GitHub Actions。`.github/workflows/pages.yml` 在推送 `master` 或手动触发时执行，使用 Node.js 24 运行 `npm run build`，上传 `dist/` 并由独立的部署任务发布。产物名称带运行重试次数，部署任务读取构建任务提供的名称。

Pages 站点位于 `/smartphoneSellOut/`。Actions 从 Cloudflare 主站的 `/api/snapshot` 读取同一时点的四份公开数据，校验 CSV 的 SHA-256 后构建静态镜像。派生销量面板读取本次构建的榜单和机型 CSV。部署产物根路径的 `sales-snapshot.json` 记录抓取时间、各表的发布版本、发布时间和校验值。每次构建成功后，在 Actions 运行详情可下载 `d1-snapshot-*` 数据包。

Cloudflare 发布数据后，在 GitHub 的 Actions 中手动运行 **Deploy GitHub Pages** 即可刷新镜像，无需再提交 CSV。代码推送也会触发镜像更新。工作流默认读取 README 的 Cloudflare 主站，可用仓库变量 `SALES_D1_ORIGIN` 调整来源。抓取或构建失败时，GitHub Pages 继续提供上次已部署的镜像。

## 管理员身份验证

在 Zero Trust 中使用针对主站 `/admin` 和 `/admin/*` 的单独 Access 应用，并通过邮箱 Allow 策略限定管理员。Worker 的生产变量 `CF_ACCESS_TEAM_DOMAIN` 和 `CF_ACCESS_AUD` 分别对应团队域名和该应用的 Audience。

打开 `/admin/api/session` 并完成 Access 登录后，应看到 `{"authenticated":true}`。若 Worker 返回 `unauthorized`，核对 Access 应用覆盖路径和两个变量的完整值。若返回 `access_not_configured`，检查生产变量。主站及公开只读 API 可以匿名访问。

## 启用数据库录入

对已导入数据的正式数据库执行以下迁移。迁移 0002 创建发布记录表，迁移 0003 和 0004 分别增加市场份额与榜单发布类型并保留既有发布记录。无需重复导入初始 SQL。

```sh
npx wrangler d1 migrations apply DB --remote
```

部署后，从 Cloudflare 主站「销量数据处理」打开「数据库录入」，或直接打开 `/admin/`。登录后可从数据库读入扩展销量表、机型表和市场份额表。编辑或批量粘贴后，点击对应的「保存到数据库」，核对整张表的新增、修改和删除数量，再确认保存。保存成功后重新读取该表，公开页面刷新后使用发布后的数据。

正式更新在同一个 D1 事务中写入变更和发布记录，记录包含表名、版本、操作人、时间和改动数量。发现较新版本时，先导出当前草稿，再重新读取并合并要保留的改动。首次写入前可在 D1 控制台备份正式库。GitHub Pages 在下一次工作流部署后读取对应快照。

在「热销机型与榜单研究」完成截图标定后，点击「保存本期榜单到数据库」。未登录时可在新标签页完成管理员登录，已有标定留在原页面。同一来源、系列和周期已有榜单时，核对后确认整期替换。榜单元数据、名次记录和发布日志在同一事务写入，日志的新增与修改数量按榜单期数记录。保存成功后页面重新读取数据库历史。若当前历史含本地 CSV 改动，先保留该历史草稿，待导出后再刷新。

## 备份和恢复

可在仓库目录导出当前公开数据到一份独立快照：

```sh
npm run snapshot:d1 -- https://smartphonesellout.zirconium.workers.dev ../sales-snapshot-2026-11-27
```

涉及数据库结构或批量修改前，可另外导出完整 SQL 到仓库目录之外。SQL 备份包含管理数据，应保存在私有位置。

```sh
npx wrangler@latest d1 export DB --remote --output ../smartphone-sales-backup.sql
```

单条数据录错时，可对照较早的 CSV 快照，从对应管理界面修正后重新发布。需要整体回滚时，在 Cloudflare D1 的 Time Travel 中选择对应的时间戳或书签。该操作会将整个库还原到该时点，包括此后的其他表修改和发布记录。先导出当前数据库，核对目标时点和影响范围后再执行整体恢复。恢复完成后可以重新部署 GitHub Pages 快照。

## 从旧邮箱验证配置迁移

部署新版后，在 Cloudflare Zero Trust 的 Access 应用中移除覆盖本站 `/studio/*` 的应用路径。如果该应用仅用于本站，可删除该应用。如果 Worker 或其域名另行启用了 Access，也需解除本站对应的保护。后台使用上述生产变量及管理员应用的 AUD。
