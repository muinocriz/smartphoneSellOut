# 业务功能 → 代码入口

路径相对仓库根目录。反引号内为可直接搜索的符号。每行从左到右沿用户操作路径定位。

| 功能 / 用户现象 | 首读路径 | 关键入口及下一跳 |
| --- | --- | --- |
| 全站导航、主题、旧首页跳转、跨页临时数据 | site-shell.js | `pages`、`applyTheme`、`sessionRead` / `sessionWrite`；生产路径另看 scripts/build-cloudflare.mjs |
| 1 累计、差分、缺周、筛选及标注 | index.html | `loadTrackingProject`、`gapData`、`historicalTrend`、`buildOption`、`placeLabels` |
| 1 单元格编辑与 CSV | index.html | `beginTempEdit` → `saveTempData`；`buildTrackingCSV` / `getTrackingUpdatedCSV`；接收端见模块 4 |
| 1/5 销售周、导出排版和文件名 | iso-sales-week.js、sales-chart-layout.js | `firstFullWeekMonday`、`partialWeek`、`lifecycleWeekIndex`；`renderPNG`、`exportFilename`；各页面调用点见模块 1/5 |
| 2 份额导入、双周堆叠与导出 | market-share-data.js、market-share.html | `parseMarketShareCSV`、`buildBrandState` → `getComputedMarketData`、`renderStackedFlowChart` → `marketPosterBlob` |
| 3 截图、像素标定、榜单历史 | sales-estimator.html、sales-estimator.js、sales-estimate-archive.js | `parseImage`、`parseAmount`、`getFit`；历史与研究启动分别查 `initEstimateArchive`、`initResearch` |
| 3 排名、身份、扩展样本和价格/代际 | sales-series.js、model-master.js、sales-fusion.js、product-research.js | `sequenceIdentity` 关联原榜；`fuse` / `buildPanel` 融合；`priceBand` / `generationAgeClassifier` 分类 |
| 3 研究预览、多周色带、双轴或跨市场图 | sales-estimate-archive.js、research-charts.js | 从 `initResearch` 查专题与参数；`drawAdjacentStackRibbons`、`drawGenerationDualAxis`、`drawDualBrandShareComparison` 分别定位绘制 |
| 3 机型销量与排名纵轴、专题散点刻度 | sales-estimate-archive.js、research-charts.js、sales-poster.js | `addTrackerHeading` 和 `renderTrackerRank` 定位独立开关与原榜排名；`logAxis` 供折线预览及图卡使用；`integerScatterTicks` 给品牌定位和长尾韧性散点图生成整数纵轴 |
| 3 图卡文案、模板与发布包 | sales-studio.js、sales-poster.js | `posterCopyDefaults`、`freezePublication`、`saveCardVersions`、`saveBundle`；模板布局进 sales-poster.js。2/3 共用 poster-export.js、poster-watermark.js、poster-themes.js |
| 4 网格编辑、特殊值、核查、撤销 | sales-data-editor.html | `commitInput` / `openSpecial`、`runChecks`、`travelHistory`、`persistDraft` |
| 4 项目/本地宽表或会话草稿导入 | sales-data-editor.html | `trackingCSV`、`previewWideSync` → `buildSyncPlan`；模块 5 入口 `incrementDraft`；导出查 `salesContent` / `masterContent` |
| 5 图表、横纵轴和 PNG | sales-increment.html、sales-increment.js | `loadSource` → `seriesRows` → `plot`；桌面 `exportChart`、手机 `exportMobileChart`，共享排版见上 |
| 5 选中机型批量编辑、草稿与长表 | sales-increment.js | `drawEditor` → `drawEditCell`；`saveEdit` / `openSpecialEdit`、`persistDraft`、`longCSV` |

专题算法细节按标题查 [模块 3 架构](../MODULE3_ARCHITECTURE.md)，出图文案按专题查 [公众图卡规范](../PUBLIC_POSTER_COPY_GUIDE.md)。旧文档与现状的已知差异见 [状态](STATE.md)。