# 业务功能 → 代码入口

路径相对仓库根目录。反引号内为可直接搜索的符号。每行从左到右沿用户操作路径定位。

| 功能 / 用户现象 | 首读路径 | 关键入口及下一跳 |
| --- | --- | --- |
| 全站导航、主题、首页跳转、跨页临时数据 | index.html、site-shell.js | `routes`（默认销量增量追踪模块）、`pages`、`applyTheme`、`sessionRead` / `sessionWrite`；生产路径另看 scripts/build-cloudflare.mjs |
| 热销机型与榜单研究模块与销量增量追踪模块 · 销售周、导出排版和文件名 | iso-sales-week.js、sales-chart-layout.js | `firstFullWeekMonday`、`partialWeek`、`lifecycleWeekIndex`；`renderPNG`、`exportFilename`；各页面调用点见热销机型与榜单研究模块、销量增量追踪模块 |
| 热销机型与榜单研究模块 · 全市场份额数据、品牌竞争与市场覆盖率 | market-share-data.js、sales-estimate-archive.js | `ensureMarketData` → `decodeCSV` / `parseMarketShareCSV` → `renderDualMarket` / `renderCoverageMarket`、`marketModelRecords`；数据源 `market-share.csv` |
| 热销机型与榜单研究模块 · 截图、像素标定、榜单历史 | sales-estimator.html、sales-estimator.js、sales-estimate-archive.js | `parseImage`、`parseAmount`、`getFit`；历史与研究启动分别查 `initEstimateArchive`、`initResearch` |
| 热销机型与榜单研究模块 · 排名、身份、扩展样本和价格/代际 | sales-series.js、model-master.js、sales-fusion.js、product-research.js | `sequenceIdentity` 关联原榜；`fuse` / `buildPanel` 融合；`priceBand` / `generationAgeClassifier` 分类 |
| 热销机型与榜单研究模块 · 研究预览、多周色带、双轴或跨市场图 | sales-estimate-archive.js、research-charts.js | 从 `initResearch` 查专题与参数；`drawAdjacentStackRibbons`、`drawGenerationDualAxis`、`drawDualBrandShareComparison` 分别定位绘制 |
| 热销机型与榜单研究模块 · 机型销量与排名纵轴、专题散点刻度 | sales-estimate-archive.js、research-charts.js、sales-poster.js | `addTrackerHeading` 和 `renderTrackerRank` 定位独立开关与原榜排名；`logAxis` 供折线预览及图卡使用；`lineAxis` / `rankAxis` 定位线性刻度；`SalesChartLayout.integerAxis` 供热销机型与榜单研究模块动态数值纵轴及销量增量追踪模块网页、桌面和移动 PNG 共用 |
| 热销机型与榜单研究模块 · 图卡内文字、模板与发布包 | sales-studio.js、sales-poster.js | `posterCopyDefaults`、`freezePublication`、`saveCardVersions`、`saveBundle`；模板布局进 sales-poster.js。公共组件 poster-export.js、poster-watermark.js、poster-themes.js |
| 热销机型与榜单研究模块 · 图卡字体与排版 | poster-typography.js、sales-studio.js、sales-poster.js、research-charts.js | `PosterTypography.mount` → `getVisualPreferences` / `capturePublication` → `drawPoster`；`posterRoleFit`、`posterFont` 与轴/图例/堆叠测量同步；配置 JSON 独立导出。 |
| 销量数据处理模块 · 网格编辑、特殊值、核查、撤销 | sales-data-editor.html | `commitInput` / `openSpecial`、`runChecks`、`travelHistory`、`persistDraft` |
| 销量数据处理模块 · 项目/本地宽表或会话草稿导入 | sales-data-editor.html | `previewWideSync` → `buildSyncPlan`；销量增量追踪模块入口 `incrementDraft`；导出查 `salesContent` / `masterContent` |
| 销量增量追踪模块 · 图表、横纵轴和 PNG | sales-increment.html、sales-increment.js | `loadSource` → `seriesRows` → `plot`；桌面 `exportChart`、手机 `exportMobileChart`，共享排版见上 |
| 销量增量追踪模块 · 选中机型批量编辑、草稿与长表 | sales-increment.js | `drawEditor` → `drawEditCell`；`saveEdit` / `openSpecialEdit`、`persistDraft`、`longCSV` |

专题算法细节按标题查 [热销机型与榜单研究模块架构](../MODULE3_ARCHITECTURE.md)，出图文案按专题查 [公众图卡规范](../PUBLIC_POSTER_COPY_GUIDE.md)。旧文档与现状的已知差异见 [状态](STATE.md)。