# Cloudflare Workers 部署

Cloudflare 从私有仓库的 `master` 分支部署 `smartphonesellout`。构建命令为 `npm run build`，部署命令为 `npx wrangler deploy`。静态资源目录为 `dist/`，发布文件由 `studio-assets.mjs` 列出。

三个模块及其已发布数据均允许匿名访问。热销机型与榜单研究模块在生产环境使用 `/studio/`，同目录包含榜单历史、研究脚本及构建生成的销量面板。市场份额模块的页面已下线，市场份额 CSV 和解析器仍保留根路径及 `/studio/` 副本，供热销机型与榜单研究模块研究使用；旧版销量追踪模块已下线，根路径通过轻量 index.html 跳转销量增量追踪模块，保留 data.csv 供销量数据处理模块导入。本地开发直接从仓库根目录读取文件。

## 从旧邮箱验证配置迁移

部署新版后，在 Cloudflare Zero Trust 的 Access 应用中移除覆盖本站 `/studio/*` 的应用路径。如果该应用仅用于本站，可删除该应用。如果 Worker 或其域名另行启用了 Access，也需解除本站对应的保护。原有 `CF_ACCESS_TEAM_DOMAIN` 和 `CF_ACCESS_AUD` 已无需配置。
