# 架构与数据流

三个模块是独立 HTML 文档，根目录直接运行。旧版销量追踪模块页面已下线，index.html 仅负责默认跳转销量增量追踪模块及兼容仍有效的旧首页 hash 链接。页面以普通 script 按顺序加载依赖，销量数据处理模块的核心逻辑有相当部分内联在 HTML。共享外壳 site-shell.js 生成导航、同步主题。外观偏好存 localStorage，主题切换发出 `site-theme-change`。导航可在 Cloudflare 与 GitHub Pages 上打开同一模块的公开页面；两个站点的浏览器草稿分别保存在各自的域名下。函数入口见 [代码索引](CODE_MAP.md)。

## 输入、派生和持久化

浏览器、Cloudflare Worker 和 Node 脚本共用 `csv-utils.js` 解码、解析和序列化 CSV。入口按既有格式选择引号及空白记录处理，导出保留各自的 BOM、换行和引号规则。表头、字段和业务约束由各表的数据层校验。静态构建在根目录和 `/studio/` 发布该脚本。

销量长表的列定义、销量类型、运算符、数值及记录身份校验由 `sales-long-data.js` 提供。正式表同步按固定列序读取，页面导入仍按各自规则识别列名与周次。销量数据处理模块保存十进制文本，研究及追踪计算在读取后转成数值。ISO 周起点来自 `iso-sales-week.js`。

Cloudflare Worker 在三个生产页面标记 D1 为正式数据源。`site-shell.js` 的 `readProject` 调用只读 JSON API，并将结果交给现有数据解析器。热销机型与榜单研究模块从当前榜单、机型及跟踪数据即时计算面板。GitHub Pages 构建保留正式 D1 快照，同时注入 Worker API origin；三个公开页面运行时经 `readProject` 跨域读取四份正式表。仅 Cloudflare 同源页面开放管理入口；读取失败显示错误，不静默回退旧快照。本地静态预览读取下表中的仓库 CSV，`data.csv` 仍供宽表导入。

| 模块 | 仓库输入 | 计算和输出 |
| --- | --- | --- |
| 热销机型与榜单研究模块 | 截图标定 → Cloudflare 管理员发布到 D1，或导出 sales-estimates.csv；model-master.csv 关联身份；按专题读取 sales-long.csv、market-share.csv | 原始排名 → 历史与研究；扩展模式融合跟踪销量。研究结果进入网页预览、工作台发布快照，再导出 PNG、CSV 或 ZIP。构建派生的 weekly-sales-panel 与浏览器即时计算分别生成。 |
| 销量数据处理模块 | sales-long.csv、model-master.csv；可预览同步项目 data.csv 或本地宽表 | 编辑累计/周增量、特殊值及主数据；冲突确认、撤销/重做、本地草稿。Cloudflare 管理员可从 `/admin/` 增量导入 GitHub 扩展销量表或本地粘贴的微博文本，再确认发布；同一后台也发布机型表和市场份额表。GitHub Pages 公开编辑仅保存草稿或导出。 |
| 销量增量追踪模块 | sales-long.csv，区分累计/周增量及运算符 | 自然周/完整销售周对比、缺周估算、选中机型表格编辑；导出 PNG/长表；可把编辑结果交给销量数据处理模块。 |

旧版销量追踪模块的 data.csv 保留并继续公开发布，作为销量数据处理模块的可选宽表导入源；不再接收旧版销量追踪模块会话草稿。市场份额模块的独立页面已下线。`market-share.csv`（每周品牌份额和大盘趋势）和 `market-share-data.js` 保留为热销机型与榜单研究模块的数据层，由 `ensureMarketData` 通过共享读取入口加载及校验。生产保留根路径及 `/studio/` 数据副本，不改变公开访问策略。

销量增量追踪模块的临时编辑、临时新增周及筛选状态保留在当前标签页的 sessionStorage；销量数据处理模块独立恢复本地草稿。两模块不再互导会话草稿，线上正式数据统一通过 D1 读取与授权发布。本地 CSV 导入、导出仍可用；已导入的历史来源可作为本地快照恢复。线上销量增量追踪模块的「从数据库更新」直接重新读取正式长表，不恢复旧数据库草稿；存在临时修改时需确认，成功后才移除旧数据库草稿，并尽量保留当前筛选和机型选择。榜单估算表 sales-estimates.csv 与跟踪长表 sales-long.csv 各自独立。

浏览器截取榜单标题主行和机型列，将标题拼到机型列上方并预览。Cloudflare 管理员经同源 `/admin/api/ranking-ocr` 发送一张 PNG 给 DeepSeek。有效 ISO 周次由用户确认填入。坐标结果排除标题并对齐已测柱条。纯文本先排除可辨认的标题行，剩余行数等于柱条数时按顺序匹配并展开核对。按机型表标准名和别名匹配后，唯一匹配填入草稿，漏读和歧义留待确认。

周度 TOP30 长表自动标定支持 iPhone 18 Pro 系列、iPhone 17 系列、iPhone Duo、REDMI K100 和 REDMI K100 Pro Max。机型表验证系列成员完整且唯一上榜，单机只验证该机型唯一上榜。相邻两周原始精确累计值无冲突且差值为正时，使用差值与对应柱长标定。合格组沿用现有拟合和异常阈值。

Cloudflare 的 `/admin/` 复用销量数据处理模块页面，并使用独立的浏览器草稿。管理员读取及保存接口验证 Access 身份。微博导入仅在管理员模式展示，解析、逐行诊断、批内去重及增量预览均在浏览器完成；只追加或人工确认覆盖草稿记录，正式写入仍走现有保存接口。市场份额微博导入独立解析多篇周报，月报整段跳过；集团份额保持含子品牌口径，复用市场份额 CSV 校验，新增默认选中、冲突须确认覆盖整周，应用仅更新可撤销草稿。原文与报告不持久化。确认保存时，Worker 对照整表、只写变更记录，并在同一 D1 批次记录操作人和表版本。版本变化时保留本地草稿，现有公开读取 API 消费发布后的业务表。

GitHub Actions 在读取静态站快照前，可将四份正式 CSV 的变更增量导入 D1。同步以持久化的 GitHub 提交为比较基线；Worker 校验版本并批量写入。执行结果由 iCloud SMTP 发给已配置的 iCloud 邮箱，记录及回执保存在 `github_csv_sync_runs`。

热销机型与榜单研究模块出图台排版覆盖值随 `StudioPreferences` 的 visual / publication 本地保存；公共元素跨图卡共享，主体按模板或研究专题隔离，缺省继承原渲染器。发布快照冻结排版配置，与 PNG、ZIP 同步；排版 JSON 仅含视觉设置。专题研究页直接导出不受出图台排版覆盖值影响。发布 ZIP 包含图卡、CSV、统计说明和配置清单。出图台的微博草稿独立于导出，点击生成才将当前图卡显示的数据和可编辑的模板发送至 DeepSeek。Cloudflare 同源页面经 `/admin/api/weibo-draft` 验证 Access 管理员身份，Worker Secret `DEEPSEEK_API_KEY` 用于调用模型。朴素简洁、深度分析和标题党风各有独立的本地提示词，默认朴素简洁。草稿仅保留在当前页面。旧 visual / publication 存储迁移时保留图卡设置并移除已退役字段。

## 运行、发布与验收

- 本地在仓库根目录执行 `python3 -m http.server 8000`，访问 `http://localhost:8000/`（跳转销量增量追踪模块）；热销机型与榜单研究模块本地入口为 `/sales-estimator.html`。本地静态预览无需构建。
- Cloudflare Workers 与 GitHub Pages 共用静态构建清单。根 package.json 的 `npm run build` 调用 scripts/build-cloudflare.mjs，根据 studio-assets.mjs 清单生成 dist/；构建时改写首页兼容跳转、热销机型与榜单研究模块导航与共享外壳相对路径，并生成榜单面板。热销机型与榜单研究模块使用站点相对路径 `studio/sales-estimator.html`。GitHub Pages 由 `.github/workflows/pages.yml` 独立发布 `dist/`，用同一份 D1 快照生成四份正式 CSV 与派生面板；运行时通过 `SALES_PAGES_API_ORIGIN` 指定的公开 API 读取最新正式数据。修改资源依赖时核对发布清单；部署细节见 [部署指南](../CLOUDFLARE_DEPLOYMENT.md)。
- 项目以用户手动验收为主，package.json 无 test 脚本。维护者可从受影响页面打开相应 CSV、操作对应控件，并核对页面或导出结果；仅按 [工作约定](../../AGENTS.md) 中的授权执行测试。
