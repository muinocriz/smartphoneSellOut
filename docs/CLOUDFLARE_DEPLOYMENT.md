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

初始 SQL 只用于空业务表，生成文件放在仓库外。导入后在 D1 控制台核对六张业务表的行数与脚本输出。若导入报错，先核对目标库及已有记录，再决定如何恢复。初始化完成前后，网站仍从现有 CSV 读取，切换数据源由后续改动完成。

## GitHub Pages

仓库 Pages 的发布来源选择 GitHub Actions。`.github/workflows/pages.yml` 在推送 `master` 或手动触发时执行，使用 Node.js 24 运行 `npm run build`，上传 `dist/` 并由独立的部署任务发布。产物名称带运行重试次数，部署任务读取构建任务提供的名称。

Pages 站点位于 `/smartphoneSellOut/`。首页跳转、顶部导航和 CSV 引用使用站点相对路径。两个平台分别部署，某一平台的发布结果需查看该平台对应的工作流或部署记录。

## 从旧邮箱验证配置迁移

部署新版后，在 Cloudflare Zero Trust 的 Access 应用中移除覆盖本站 `/studio/*` 的应用路径。如果该应用仅用于本站，可删除该应用。如果 Worker 或其域名另行启用了 Access，也需解除本站对应的保护。原有 `CF_ACCESS_TEAM_DOMAIN` 和 `CF_ACCESS_AUD` 已无需配置。
