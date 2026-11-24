# Cloudflare Workers 分模块访问部署

目标：模块 1／2／4 公开，模块 3 仅指定邮箱可以使用。模块 4 自动读取公开的 data.csv 和 model-master.csv；其编辑只在浏览器本地生效。不要将整个仓库作为静态资产目录。

## 历史生产验收记录（2026-11-20，模块 2 公开前）

- 生产入口：[https://smartphonesellout.zirconium.workers.dev/](https://smartphonesellout.zirconium.workers.dev/)；部署类型为 Cloudflare Workers（非 Cloudflare Pages），GitHub 私有仓库 `master` 为部署来源。
- GitHub 仓库可见性 Private 已通过 GitHub 仓库元数据确认；维护者报告旧 GitHub Pages 已关闭。
- 维护者确认 Access 指定邮箱一次性验证码认证成功，且以下三个线上入口符合预期：

| 入口 | 维护者确认结果 |
| --- | --- |
| `/` | 未登录可正常打开模块 1 |
| `/studio/market-share.csv` | 无痕、未登录访问要求认证 |
| `/studio/sales-estimates.csv` | 无痕、未登录访问要求认证 |

以上三项为维护者实际确认；文档更新方未独立取得线上 HTTP 响应。旧 GitHub Pages 的 HTTP 状态、其他旧部署／别名、旧根路径、全部私有资产、会话过期以及完整自动构建流程未在此次文档更新中独立验证，后续按第 3 节验收。不得将此记录视为全面安全审计。

2026-11-21：源码调整为模块 1／2 公开、仅模块 3 授权。保留原 `/studio/*` Access 策略及 JWT 校验，模块 2 改用根目录公开资源。此次代码变更未执行构建或线上验收，实际生产状态以重新部署后的验收为准。

## 1. 安全边界

- `dist/` 由 `npm run build` 重新生成。根目录按 `studio-assets.mjs` 白名单发布首页、模块 1／2／4 的 CSV、页面及依赖；模块 3 的页面、历史 CSV、机型主数据 `model-master.csv`、衍生数据与依赖全部放在 /studio/。机型主数据同时按维护者要求发布根目录公开副本，两个路径使用同一源文件。保留模块 2 资源的受保护兼容副本（含跨模块研究所需 market-share.csv），从同一源文件构建，不另行维护数据。
- `wrangler.jsonc` 的静态资产目录为 dist；`cloudflare-worker.mjs` 拦截除明确公开资产以外的请求。私有资源及 /studio/session.json、/studio/login 均要求由 Access 签发且通过签名、发行方、AUD、过期时间校验的 JWT；缺少配置直接返回 503，缺少或无效凭证拒绝。私有响应禁止缓存。不要删除路由拦截、直接发布 dist，或把私有文件移出 /studio/。
- 邮箱授权在 Cloudflare Access 配置中管理，不把邮箱名单、令牌或密钥写入网页、源码、CSV。Access 策略才是授权主体；Worker 不接受网页传入的邮箱或伪造登录状态。
- 首页保留原来的两个 hash 导航；hash 本身不是安全边界。模块 2 直接载入根目录同源 iframe，无需登录；模块 3 检查 /studio/session.json 后才载入受保护 iframe，未授权时显示顶层登录链接，到 /studio/login 完成身份验证后返回模块 3。
- 原根目录的本地开发预览仍可直接访问三模块，不应用 Access；只能在信任的本地网络运行。任何公开站点必须用本部署流程。模块 1 的 data.csv 和模块 2 的 market-share.csv 是公开数据，任何访客均可下载；授权用户仍可保存模块 3 的数据。

## 2. 配置基线与重新部署（现有 smartphonesellout Worker）

1. 首先将 GitHub 源仓库设为 Private，并确认旧 GitHub Pages 已关闭、任何旧公开站点及可访问的历史部署都不再提供私有 CSV。此前公开过的数据可能已被下载，无法追回。
2. Cloudflare Zero Trust → Access → Applications → Add an application → Self-hosted。添加你实际的生产 workers.dev 主机名，路径 /studio/*（如需保护目录本身也可添加 /studio）。不要对整个 Worker 启用 All traffic 身份验证，否则模块 1／2 也需登录。应用名可设 Smartphone Studio。创建 Allow 策略，Include 选择 Emails，仅填入你和获准人员的完整邮箱；登录方式 One-time PIN 或已有身份提供程序。允许会话时长按需设定（例如 24 小时）。不要配置 Everyone、邮箱域名通配、Bypass。记录应用的 Application Audience (AUD) 和 Zero Trust team domain。
3. Workers & Pages → smartphonesellout → Settings → Variables and Secrets：增加文本变量 CF_ACCESS_TEAM_DOMAIN（完整 https://<team>.cloudflareaccess.com）、CF_ACCESS_AUD（第 2 步的应用 AUD）。AUD 与域名不是密码；授权名单由 Access 管理。配置文件 keep_vars=true 保留控制台变量。
4. 在该 Worker 的 Builds 设置中保持生产分支 master、根目录为仓库根；使用 npm 安装依赖（Workers Builds 默认安装，必要时构建命令填 npm install --no-audit --no-fund）；部署命令须为 npx wrangler deploy。wrangler 的自定义 build.command 会执行 npm run build。不要附加 --assets=. 或 --assets=dist；使用仓库配置确保请求经过 Worker 校验。首次部署需使控制台变量随部署生效。项目名 smartphonesellout 与 Worker 名一致。
5. 保持 workers.dev 生产 URL 启用；关闭 Preview URLs（配置已设 preview_urls:false），不要启用其他可绕过访问控制的域名／路由；不要恢复旧的未保护 Worker 版本。确认旧部署、根目录 sales-estimates.csv 及模块 3 的其他私有资源、旧 GitHub Pages、其他公开别名均已关闭或不可访问。

## 3. 完整验收清单（维护者自行完成）

- 无痕窗口访问根网址：模块 1／2／4 均无需登录，/data.csv、/market-share.html、/market-share.csv、/sales-data-editor.html、/model-master.csv 和公开依赖正常返回；确认模块 2 自动读取 CSV、图表和导出功能正常。模块 3 显示授权入口；直接匿名访问 /studio/sales-estimator.html、/studio/sales-estimates.csv、/studio/model-master.csv、/studio/weekly-sales-panel.csv、/studio/weekly-sales-panel.meta.json 及私有 JS 不得返回私有内容；根路径 /sales-estimator.html、/sales-estimates.csv 和衍生数据也不得返回；根路径 /model-master.csv 是模块 4 有意公开的资源。/studio/market-share.csv 仍要求认证，而根路径 /market-share.csv 有意公开。
- 通过授权邮箱顶层登录：返回模块 3，允许加载 iframe 及完整历史数据；确认跨模块市场份额研究可以读取 /studio/market-share.csv。会话有效期内从公开模块切回模块 3 不重复登录；未授权邮箱不得通过。检查会话过期后再次进入模块 3 是否需要登录，且模块 1／2 不受影响。
- 配置和实际部署未验收前不能声称数据已私有。新增文件时审查构建白名单及 Worker 路由，不能将私有资产加入公开路径。

参考：[Cloudflare Workers Access 路径保护](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#protect-a-specific-hostname-custom-domain-or-path)、[Access JWT 校验](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)、[Static Assets 配置](https://developers.cloudflare.com/workers/static-assets/binding/)。

模块 4 新增验收项：重新部署后，匿名访问 `/sales-data-editor.html` 与 `/model-master.csv` 应正常返回；模块 4 应自动读取两个项目 CSV，并在存在本地草稿时优先恢复，保留手动导入及重新读取按钮。匿名访问 `/studio/model-master.csv` 仍必须被拦截，授权访问正常；其内容与公开根路径相同，不再视为秘密。此项尚未执行线上验收。
