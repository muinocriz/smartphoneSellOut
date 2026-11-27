# 业务功能 → 代码入口

路径相对仓库根目录。反引号内为可直接搜索的符号。每行从左到右沿用户操作路径定位。

| 功能 / 用户现象 | 首读路径 | 关键入口及下一跳 |
| --- | --- | --- |
| 全站导航、主题、首页跳转、跨页临时数据 | index.html、site-shell.js | `routes`（默认销量增量追踪模块）、`pages`、`applyTheme`、`sessionRead` / `sessionWrite`；生产路径另看 scripts/build-cloudflare.mjs |
| 全站导航 · 当前部署提交 | scripts/build-cloudflare.mjs、site-shell.js、site-shell.css | `prepareModulePage` 将构建工作区的 Git HEAD 写入页面及导航资源 URL；导航显示 7 位短 SHA 并链接完整提交。 |
| D1 运行时读取（含 GitHub Pages） | site-shell.js、scripts/build-cloudflare.mjs、cloudflare-worker.mjs、.github/workflows/pages.yml | `readProject` / `projectSupportsAdmin` → `readData`；构建注入 `SALES_PAGES_API_ORIGIN`，公开四表允许跨域 |
| D1 数据快照、静态站发布与派生销量面板 | cloudflare-worker.mjs、scripts/export-db-snapshot.mjs、scripts/build-cloudflare.mjs、.github/workflows/pages.yml | `readPublicSnapshot` → `snapshotCSV` / `verifySnapshot` → `generateSalesPanel`；部署元数据 `sales-snapshot.json` |
| GitHub CSV 自动同步与结果邮件 | .github/workflows/pages.yml、scripts/sync-github-csv.mjs、cloudflare-worker.mjs、github-csv-sync.mjs | `changedSchemas` / `planSheet` → `githubSyncRoute` → `applyGitHubCSV`；`deliverReports` → `scripts/send-icloud-mail.py` 通过 iCloud SMTP 发送结果 |
| 热销机型与榜单研究模块与销量增量追踪模块 · 销售周、导出排版和文件名 | iso-sales-week.js、sales-chart-layout.js | `firstFullWeekMonday`、`partialWeek`、`lifecycleWeekIndex`；`renderPNG`、`exportFilename`；各页面调用点见热销机型与榜单研究模块、销量增量追踪模块 |
| 热销机型与榜单研究模块 · 全市场份额数据、品牌竞争与市场覆盖率 | market-share-data.js、sales-estimate-archive.js | `ensureMarketData` → `decodeCSV` / `parseMarketShareCSV` → `crossMarketPanel` / `fillRangeControls` / `fillDualWeeks` → `renderDualMarket` / `renderCoverageMarket`、`marketModelRecords`；数据源 `market-share.csv`（华为集团含 OSTA，独立子份额由解析器提供；母品牌归属见 `brand-utils.js`） |
| 热销机型与榜单研究模块 · 榜单截图 OCR | sales-estimator.html、sales-estimator.js、cloudflare-worker.mjs、ranking-ocr.mjs | `findRankingTitle` / `drawRankingCrop` → `recognizeRankingImage` → `alignRankingLabels` → 机型表校验与名称草稿；标题由 `readRankingPeriod` 提取周次，`applyRankingPeriod` 填入归档控件 |
| 热销机型与榜单研究模块 · 截图、像素标定、榜单历史 | sales-estimator.html、sales-estimator.js、sales-estimate-archive.js | `parseImage`、`parseAmount`、`getFit`；系列与单机长表自动标定查 `syncTrackingCalibrations`；历史与研究启动分别查 `initEstimateArchive`、`initResearch` |
| 热销机型与榜单研究模块 · 发布当期榜单 | sales-estimate-archive.js、cloudflare-worker.mjs、ranking-editor-database.mjs | `buildRows` → `requestRanking` → `adminRoute` / `verifyAdmin` → `publishRanking` / `saveEditorRelease`；发布类型迁移见 `migrations/0004_ranking_editor_releases.sql` |
| 热销机型与榜单研究模块 · 排名、身份、扩展样本和价格/代际 | sales-series.js、model-master.js、sales-fusion.js、product-research.js | `sequenceIdentity` 关联原榜；`fuse` / `buildPanel` 融合；`priceBand` / `generationAgeClassifier` 分类 |
| 热销机型与榜单研究模块 · 同档代际与替代配对 | sales-estimate-archive.js | `tierPairPreset` 定位自动配对；`fillGenerationChoices` → `comparableGeneration` 过滤前代候选 |
| 热销机型与榜单研究模块 · 研究预览、多周色带、双轴或跨市场图 | sales-estimate-archive.js、research-charts.js | 从 `initResearch` 查专题与参数；`drawAdjacentStackRibbons`、`drawGenerationDualAxis`、`drawDualBrandShareComparison` 分别定位绘制 |
| 热销机型与榜单研究模块 · 机型销量、排名与加权首发价纵轴、专题散点刻度 | sales-estimate-archive.js、research-charts.js、sales-poster.js | `addTrackerHeading` 和 `renderTrackerRank` 定位独立开关与原榜排名；`positionAxis` 经 `attributeSettings` 传给加权首发价趋势及导出；`lineAxis` / `rankAxis` 定位线性刻度；`SalesChartLayout.logAxis` 供销量增量追踪模块和热销机型与榜单研究模块的对数折线及导出使用，与动态整数刻度 `SalesChartLayout.integerAxis` 同在 `sales-chart-layout.js` |
| 热销机型与榜单研究模块 · 图卡内文字、模板与发布包 | sales-studio.js、sales-poster.js | `posterCopyDefaults`、`freezePublication`、`saveCardVersions`、`saveBundle`；模板布局进 sales-poster.js。公共组件 poster-export.js、poster-watermark.js、poster-themes.js |
| 热销机型与榜单研究模块 · 微博文案 | sales-studio.js、cloudflare-worker.mjs、weibo-draft.mjs | `weiboCardData` → `initWeiboDraft` → `adminRoute` / `verifyAdmin` → `generateWeiboDraft`；取当前图卡显示数据，风格切换查 `weiboStyleOptions`，提示词和生成逻辑查 `initWeiboDraft`。 |
| 热销机型与榜单研究模块 · 图卡字体与排版 | poster-typography.js、sales-studio.js、sales-poster.js、research-charts.js | `PosterTypography.mount` → `getVisualPreferences` / `capturePublication` → `drawPoster`；`posterRoleFit`、`posterFont` 与轴/图例/堆叠测量同步；`posterXAxisLayout` / `posterYAxisTick` / `posterAxisGutter` 统一轴距，专题 `spacing` 配置随排版 JSON 导出。 |
| 销量数据处理模块 · 网格编辑、特殊值、核查、撤销 | sales-data-editor.html | `commitInput` / `openSpecial`、`runChecks`、`travelHistory`、`persistDraft` |
| 销量数据处理模块 · 项目/本地宽表、GitHub 扩展销量表及会话草稿导入 | sales-data-editor.html | `previewSync` / `readGitHubSales` → `buildSyncPlan`；销量增量追踪模块入口 `incrementDraft`；导出查 `salesContent` / `masterContent` |
| 销量数据处理模块 · 微博文本导入 | weibo-sales-parser.js、sales-data-editor.html、studio-assets.mjs | `WeiboSalesParser.parse` → `openWeiboSalesImport` / `buildSyncPlan` → `renderSyncPlan` / `saveWeiboReport`；后台专用入口，复用草稿合并及数据库保存 |
| 销量数据处理模块 · 市场份额微博导入 | weibo-market-parser.js、sales-data-editor.html、market-share-data.js、studio-assets.mjs | `WeiboMarketParser.parse` → `marketImportIndex` / `weiboMarketParse` / `weiboMarketApply`；仅周报，复用市场份额校验和草稿保存 |
| 销量数据处理模块 · 数据库整表录入 | sales-data-editor.html、cloudflare-worker.mjs、sales-editor-database.mjs | `reviewDatabase` → `adminRoute` / `verifyAdmin` → `readEditorSheet` / `editEditorSheet`；市场份额网格见 `renderMarketGrid`，写入校验复用 `parseMarketShareCSV`；发布记录见 `migrations/0002_sales_editor_releases.sql` 和 `migrations/0003_market_share_editor_releases.sql` |
| 销量增量追踪模块 · 图表、横纵轴和 PNG | sales-increment.html、sales-increment.js | `loadSource` → `seriesRows` → `plot`；桌面 `exportChart`、手机 `exportMobileChart`，共享排版见上 |
| 销量增量追踪模块 · 品牌与机型列表 | sales-increment.js | `syncBrand` → `choiceKeys` / `applyKeys`；近12周新机按 `recentModelKeys` 生成 |
| 销量增量追踪模块 · 选中机型批量编辑、草稿与长表 | sales-increment.js | `drawEditor` → `drawEditCell`；`saveEdit` / `openSpecialEdit`、`persistDraft`、`longCSV`；顶部导入查 `start` → `applySource` → `loadSource`，销量数据处理模块通过 `pagehide` 发布会话更新 |

专题算法细节按标题查 [热销机型与榜单研究模块架构](../MODULE3_ARCHITECTURE.md)，出图文案按专题查 [公众图卡规范](../PUBLIC_POSTER_COPY_GUIDE.md)。旧文档与现状的已知差异见 [状态](STATE.md)。