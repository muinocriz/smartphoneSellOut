# 开发状态 · 2026-11-28

业务核对基线为 master 的 `866b48a624a5c98bbe93bf2bf00b28d08c328770`。下表区分已提交的实现与人工验收。后续接手先比较基线到当前 HEAD 涉及本任务的路径；完整历史见 [CHANGELOG](../../CHANGELOG.md)。

| 范围 | 已提交状态或已知问题 | 对应提交 / 核对点 |
| --- | --- | --- |
| 共用 CSV 读写 | 三个模块、Worker 与 Node 共享 CSV 语法。待用户核对本地导入、草稿互导、发布包和同源数据的快照散列。 | `CsvUtils`，`40d7d4e` |
| 共用 ISO 自然周 | 编辑器、销量微博解析、Worker 和研究计算复用 ISO 周起点。待用户核对跨年、有效及无效的第 53 周和宽表缺省年份。 | `IsoSalesWeek.isoWeekMonday`，`b84fee5` |
| 共用销量长表结构与校验 | 页面、Worker 和 GitHub 同步复用列规范、类型与记录校验。待用户核对不同入口的列名、数值和重复记录兼容。 | `SalesLongData` 随本次改动 |
| 销量数据处理模块 · D1 录入 | 管理员入口复用现有编辑器，扩展销量表和机型表可以核对整表变更后保存。正式库需应用发布记录迁移，待用户验收保存、冲突保护和公开页面刷新。 | `reviewDatabase` / `editEditorSheet`，`85fe686` |
| 销量数据处理模块 · D1 市场份额录入 | 管理员可以编辑周度份额并确认发布，复用全市场研究的份额校验。待应用 0003 迁移并由用户验收。 | `renderMarketGrid` / `validateMarketShares`，`a282400` |
| 销量数据处理模块 · GitHub 扩展销量表导入 | 后台按机型、周次和销量类型核对 master 上的长表，应用到草稿后确认发布。待用户验收特殊值覆盖与仅在库记录保留。 | `readGitHubSales` / `buildSyncPlan`，`c2b12e0` |
| 销量数据处理模块 · 市场份额微博导入 | 多周解析、月报跳过、ISO 日期核对、整周冲突预览和草稿合并；待用户验收及生产部署。 | `WeiboMarketParser.parse` / `weiboMarketApply`，`cbb1ef8` |
| 销量数据处理模块 · 微博文本导入 | 后台粘贴多个数据块，解析及逐行报告、批内去重、冲突确认、批量草稿合并；待用户验收格式漂移、异常报告、撤销及生产部署。 | `b88689a` / `f7263369` / `4facddc`，`WeiboSalesParser.parse` / `buildSyncPlan` |
| 热销机型与榜单研究模块 · D1 榜单发布 | 截图标定后可发布或整期替换榜单，使用 Access 管理员身份和数据库版本核对。待应用 0004 迁移并由用户验收。 | `requestRanking` / `publishRanking`，`fee3ae0` |
| 销量增量追踪模块 · 品牌筛选 | 点击「全部品牌」时进入近12周新机列表，局部全选仅勾选可见新机。待用户验收。 | `d29a4ce`，`syncBrand` / `choiceKeys` |
| 销量增量追踪模块 · 逐周明细 | 已移除底部单机逐周明细及其展示字段。图例点击继续高亮对应曲线。待用户验收。 | `0461e2e`，`draw` / `seriesRows` |
| 销量增量追踪模块 · 编辑 | 已选机型同表编辑，普通格填精确值，特殊类型从弹窗录入。待用户验收多机型切换及导出后由销量数据处理模块导入。 | `b735920`，drawEditor / openSpecialEdit |
| 销量增量追踪模块 · 导航 SVG 冲突 | GitHub 图标加入后，销量增量追踪模块全局 SVG 查询误将图表画入导航，且全局 SVG 样式放大图标。改为专用 incrementChart ID，图标尺寸独立；待用户验收。 | `782a2c6`，`render` / `screenChart` / `incrementChart` |
| 销量增量追踪模块 · 轴范围 | 网页、桌面导出采用整数刻度，随后收紧纵轴顶部留白。切换指标、横轴或机型列表时恢复所选机型的全部周期。原先切换自建列表会沿用前一列表的起止周，已复用「全部周期」逻辑。默认载入「近12周新机」及再次点击非空列表时也重新计算起止周，待用户验收。 | `2c4c7c9` → `2295401`；横轴 `6d4f8e0`、`675eecb`；列表 `16d0df3`、`a5f6b72`，`applyKeys` / `renderLists` / `syncBrand` |
| 热销机型与榜单研究模块 · 研究导航 | 曾因删除标题后初始化代码仍依赖 h2，导致研究导航中断；已有修复。研究导航按 `initResearch` 的容器定位，架构指南已同步。 | 标题删除 `438db01`；修复 `be9d580` |
| 热销机型与榜单研究模块 · 深色显示与图卡标题 | 控件对比度、金额校验提示主题已调整；跨模块专题出图标题已缩短。 | `7fbd363`、`5681704`、`21f162b` |
| 热销机型与榜单研究模块与销量增量追踪模块 · 动态整数刻度 | 热销机型与榜单研究模块线性折线、散点、销量堆叠、代际替代销量、榜单流动和市场规模复用销量增量追踪模块的动态整数步长，销量增量追踪模块移动 PNG 也采用同一规则。生产发布清单已补齐 `/studio/sales-chart-layout.js`，待部署验收。 | 共用刻度 `1e4dc0a`；静态资源发布 `c887180`，`studio-assets.mjs` |
| 热销机型与榜单研究模块 · 研究纵轴 | 销量与原榜排名各自切换线性或对数纵轴，导出沿用当前设置。品牌定位与长尾韧性的目标散点图改用动态整数纵轴。待用户验收。 | `8935d68`，`lineAxis` / `renderTrackerRank` |
| 销量增量追踪模块与热销机型与榜单研究模块 · 对数刻度 | 网页、桌面和移动 PNG、研究预览及图卡的对数折线纵轴共用 1、2、5 倍刻度；跨多个数量级时减少刻度，窄范围细化刻度，原榜排名只用正整数。待用户验收。 | `347f580`，`SalesChartLayout.logAxis` |
| 热销机型与榜单研究模块 · 出图台字体与排版 | 左栏底部新增独立元素的字号、字体、字形、字重、加粗、单项/全部重置和 JSON 导出，接入实时画布与冻结发布快照。待人工验收各专题密集布局、字体回退及导出一致性。 | `bf7585f`、`4a547d6`，`PosterTypography.mount` / `drawPosterWithTypography` |
| 热销机型与榜单研究模块 · 图卡坐标轴间距 | 出图台新增专题横轴、纵轴及轴标签与下方图例净距配置；实测轴字形并同步预留空间，待用户验收堆叠、双轴、散点和多子图导出。 | `posterXAxisLayout` / `posterYAxisTick` / `PosterTypography.spacing`，`c731e20` |
| 热销机型与榜单研究模块 · 出图台堆叠图图例 | 新老代际结构、价格带等多周堆叠图曾按固定列宽逐项缩小图例。现在按选定字号测量和换行，预览与图卡导出使用同一布局。待用户验收。 | `2bd2f76`，`posterLegendLayout` / `drawBrandComposition` |
| 热销机型与榜单研究模块 · 出图台功能精简 | 移除自动发布文案、栏目模板、社媒标题与轮播脚本，清理生成/切换/复制/下载、发布快照及 ZIP 中相关字段。旧本地方案迁移保留图片设置，待用户验收基础图卡和专题出图。 | `b64a115`，`capturePublication` / `StudioPreferences.read` |
| 全站页面与发布文档 | 旧版销量追踪模块和市场份额模块的独立页面已下线。首页跳转销量增量追踪模块，仍有效的旧 hash 链接兼容；销量数据处理模块移除旧版销量追踪模块会话导入，保留项目及本地宽表同步、销量增量追踪模块草稿。data.csv、市场份额数据层和公共组件均保留。待用户验收首页、三个模块导航、导入及部署。域名侧实际配置需独立核实。 | 拆页 `921b74f`；下线 `6c8b49f`、`a51938e`，`index.html` / `site-shell.js` / `sales-data-editor.html` |
| 销量增量追踪模块 · 导入来源 | 顶部支持项目、本地 CSV 和销量数据处理模块的同标签页更新导入。待用户验收更新按钮状态、新增空周和反向交接。 | `1c8bf69`，`applySource` / `pagehide` |
| 热销机型与榜单研究模块 · 出图台字号 | 图例、轴刻度／周次、堆叠区块数值默认 8，字重 400。待用户验收新老代际结构及价格带图卡。 | `53ca9e8`、`eb0c50b`，`PosterTypography.size` |
| 发布 · GitHub Pages | Pages 与 Cloudflare Workers 分别运行部署，共用静态构建产物。Pages 构建与部署分工，按重试次数区分产物。 | `94114fc`、`37b0a71`，`.github/workflows/pages.yml` |
| 发布 · GitHub Pages 实时读取 D1 | 构建注入公开 Worker origin，四表运行时读取，管理入口仍限同源；待 Worker 和 Pages 部署及用户验收。 | `readProject` / `projectSupportsAdmin`，`5b4988e` |
| 发布 · D1 数据快照 | 四张公开数据表与版本在一次批处理内读取，GitHub Pages 由同一快照构建与存档。待 Cloudflare 路由部署及用户验收镜像。 | `readPublicSnapshot` / `verifySnapshot`，`430f698` |
| 发布 · GitHub CSV 自动同步 | 按上次 GitHub 基线对照 D1，保留冲突和来源缺行；写入后生成 Pages 快照并发送结果邮件。待应用 0005、配置同步密钥、iCloud 地址及 App 专用密码，随后由用户验收。 | `planSheet` / `applyGitHubCSV` / `deliverReports`，`9618ed3` / `6d0be9f` |
| 热销机型与榜单研究模块 · 跨市场周次 | 两个 CSV 更新进度不一致时，跨市场专题以两源周历范围显示自然周，标注缺失来源；其他专题仍用原始榜单或扩展样本周历。默认追随最新周，跨市场区间记忆独立，缺失贡献不补零。待用户验收。 | `crossMarketPanel` / `fillRangeControls` / `fillDualWeeks`，`25ad13a` |
| 全市场份额及品牌归属 · OSTA 星芒 | W47 保持同源华为 22.3%、OSTA 0.1%，六大厂商合计口径不变；旧表头及未披露子份额兼容，母品牌仍为华为、机型品牌为 OSTA。待用户验收跨市场专题及新增机型录入。 | `parseMarketShareCSV` / `BrandUtils.classify` / `model-master.js`，`6f4787f` |
| 华为系展示与选择器 | 母品牌图表、派生分析表、研究筛选器统一显示华为系，保留华为原键；品牌筛选提供 OSTA 星芒独立选项，无样本时为空；销量增量追踪品牌按钮按实际源数据生成。机型表录入提示同步。待用户验收网页预览、导出及旧筛选配置。 | `BrandUtils.groupLabel` / `ProductResearch.filterKey` / `refreshProductFilters`，`7913a0f` |
| 热销机型与榜单研究模块 · 同档代际对比 | 主数据自动配对要求新旧两代在当前分析范围内均有可用序列；待用户验收。 | `tierPairPreset`，`bb2ee4e` |
| 热销机型与榜单研究模块 · 代际替代分析 | 前代下拉框按当前范围和比较对象筛选，至少一周双边销量有效且合计为正才提供该配对。待用户验收配对机型和系列口径。 | `fillGenerationChoices` / `comparableGeneration`，`2fce529` |
| 热销机型与榜单研究模块 · 加权首发价趋势 | 新增线性与对数纵轴设置，默认线性。网页图表、专题 PNG 和出图台共用选定刻度，待用户验收。 | `positionAxis` / `ResearchCharts.lineAxis`，`e4e372a` |
| 热销机型与榜单研究模块 · 长表自动标定 | 适用两个苹果系列和三款单机。W46 长表缺 iPhone Duo 当周累计，自动标定应跳过。 | `8be42f2` 系列接入；`syncTrackingCalibrations` 单机扩展随本次改动 |
| 热销机型与榜单研究模块 · 榜单机型 OCR | 真实榜单的 OCR 返回逐行纯文本。已支持行数相等时按顺序生成草稿。页面保留当次原始返回。标题主行与机型列合并为一次 OCR，待用户验收。 | `a8094fa` 接入；`8261f2a` 诊断；`029a651` 纯文本；`29a7969` 标题识别；合图随本次改动 |
| 热销机型与榜单研究模块 · 微博文案 | 手动生成、编辑和复制草稿。支持朴素简洁、深度分析和标题党风，三档提示词分别保存。深度分析可从同口径图表数据直接计算变化。周度 TOP30 约覆盖六成销量仅作模型解读约束。必要口径写在观察句中，正文不加免责声明或图例解释。修复 Worker 不支持的重定向模式导致的 502，区分上游重定向、HTTP 错误和响应读取失败。待部署后由用户验收。 | `36e43c0` 接入；`a20ca65` 修复 502；`311db31` 约束正文；`866b48a` 风格切换 |
| 跨模块稳定性与性能优化 | 修复热销机型与榜单研究模块 OCR 与销量数据处理模块后台请求在 Access 会话过期时跟随重定向触发 CORS 异常的问题；Worker `verifyAdmin` 增加 Access JWKS 内存缓存；优化销量数据处理模块 `masterPatch` 合并校验、`refreshDerived` 查找与 `captureChange`/`persistDraft` 重复序列化；优化销量增量追踪模块 `seriesRows` 重复全表扫描；修复 `export-db-snapshot.mjs` 目标目录非空时 `rename` 失败。待用户验收。 | `requestRankingOCR` / `databaseRequest` / `verifyAdmin` / `refreshDerived` / `persistDraft` / `groupRecordsByKey` / `exportSnapshot`，`4c5cc7c` |
| 热销机型与榜单研究模块 · 多品牌联合下界与长尾在榜率 | `coverage` 与 `dual` 统一在 `marketModelRecords` 启用六大集团联合必要下界（保留苹果单锚点与触发锚点列）；`tail` 新增近期在榜率、含门槛上界的窗口周均区间、按 `windowMeanUpper` 排序的层内销量优先规则，散点图新增在榜率外环弧与可开关区间须线（网页预览、出图台海报及导出清单同步）。待用户验收。 | `marketModelRecords` / `renderCoverageMarket` / `tailSettings` / `drawTailScatter` / `researchManifest`，随本次改动 |

本次文档同步核对了提交和相关源码，人工验收由维护者执行。记录新的问题时写明触发条件、影响、证据 SHA 与处置状态；修复后替换原行。证据基线可用于复查，只有经历史确认才标作引入提交。
