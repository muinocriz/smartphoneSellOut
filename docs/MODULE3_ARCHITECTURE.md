# 模块3架构与派生数据
- sales-estimator.html：页面结构；sales-estimator.js：标定及原始榜单 UI。
- sales-estimate-archive.js：历史存档、研究交互与专题指标；内部使用 initEstimateArchive()、initResearch() 分隔初始化；sales-series.js：纯 CSV 校验和周序列计算，浏览器及 Node 共用。
- research-charts.js：折线比例与点段数据共享，SVG 预览保留 tooltip，Canvas 导出；堆叠、流向、柱状及散点共用 Canvas 渲染。
- sales-poster.js：海报几何、模板、水印、布局审计；sales-studio.js：发布操作及冻结快照。
- studio-preferences.js：版本化本地配置；不存原始 CSV、身份凭证或研究数据快照。研究参数与分组自动保存，可清除；视觉偏好自动保存；发布方案显式保存/恢复，数据变化时不复用旧统计文案。
- studio-assets.mjs：构建与 Worker 共用公开/受保护资源名单。模块1/2公开；模块3历史/衍生生成物仅经 /studio/ Access 校验后可访问，模块2 CSV 的受保护副本供跨模块专题使用。
- poster-export.js / poster-watermark.js / poster-themes.js：模块2/3共享导出作业、分辨率、下载、水印与主题，业务渲染仍分别负责。

## 派生 CSV
原始事实数据为 sales-estimates.csv；页面实时计算，不依赖离线派生文件。默认口径覆盖率 80%、首次观测分母、最长 3 周、门槛约束插补。每次 Cloudflare 构建自动生成 dist/studio/weekly-sales-panel.csv 和 weekly-sales-panel.meta.json，不写回 GitHub。清单包含源文件、算法和品牌规则 SHA-256、输出哈希、版本、参数和行数。算法逻辑变更应更新 SalesSeries.VERSION。导出 CSV 附带算法版本。
旧 weekly-sales-panel.csv 已从当前分支移除，可通过 Git 历史找回。运行 npm run generate:panel 在 generated/ 生成本地副本和清单（不纳入版本控制）；也可传入目标目录（npm run generate:panel -- <目录>）。构建不覆盖原始 CSV。生成清单不含时间戳，便于相同输入的可复现性比较。

本项目不再维护 tests/ 自动测试目录；人工验收需检查模块2/3访问、研究导航及恢复、图表预览/导出、重新加载配置和部署生成物。

## 历史代码清理
四个 Tab 的静态骨架直接位于 sales-estimator.html；主题状态只由 socialState.theme 管理，模块2／3共用完整主题 ID；renderAll 直接协调标定、发布与历史控件，不重复包装。不再读取旧版水印键；模块2和模块3只读取当前版本的本地配置，版本不匹配时使用默认值，不逐项迁移。模块2默认不包含历史示例份额，只有完整有效的两周数据才允许导出。

## 初始化与故障隔离（2026-11-21）

- 先提供 SalesEstimateArchive API，再启动 loadRepository()；估算存档初始化和研究初始化分别包在异常处理内。CSV 请求及解析错误单独记录，研究初始化失败不应阻止历史读取。
- 历史状态更新先刷新历史列表及状态，再分别同步图文工作台、估算控件和研究数据。研究通过内部返回的 refreshTracker / sendResearchToStudio 接口取得更新；异常写入控制台，研究状态显示失败，不把研究异常当成 CSV 解析失败。
- 删除了已移除提示元素 trackerParameterHint 和 tracker .panel-desc 的引用；研究导航锚定保留的 h2 标题。未来移除 HTML 时应同时检查 DOM 查询、事件绑定及布局锚点。
- 这是同文件内功能级隔离：history、loaded 等状态仍共享，脚本加载顺序及公共接口仍存在依赖，未拆分为独立数据仓储或 ES 模块，不宣称任意错误均被隔离。相关提交 e55eded / 2cb2c2f 尚未运行测试。

## 双版本出图

启用抖音安全区后可导出当前布局及规避版/完整版；两种版本共享同一发布内容和选择的分辨率，只有安全区启用状态不同。默认右侧13%、底部10%；预览参考线不进入成品。PosterExport 串行生成 PNG，提供独立下载入口，降低并行画布内存峰值。

## 机型主数据与统一序列身份

- 根目录 `model-master.csv` 是长期属性表，独立于 `sales-estimates.csv`，首次入库 53 行、19 列，UTF-8 BOM。生产构建仅复制到 `/studio/model-master.csv`，受原 Access 和 Worker JWT 校验保护；公开根路径不可发布。
- 字段顺序：`model_id,model_name,brand,brand_group,aliases,series,generation,variant,form_factor,sale_start_date,predecessor_id,launch_price,chip_vendor,chip_model,base_ram,base_rom,source_url,notes,verification`。
- 关联规则：永久机型 ID 唯一，名称与别名用现有 BrandUtils.normalize 精确匹配；不自动合并不同型号。新上榜补录，退出保留，重新上榜复用。合并统计项独立保留，不分摊销量。上一代 ID 可以指向尚未入库或无销量的机型；不因此拒绝文件，不补零或计算无依据的代际增速。
- 正式开售日期而非发布日期；首发价为人民币元、RAM/ROM 为 GB，数值无单位后缀。芯片名称以维护者归类为准，不自动剥除后缀。来源、备注与核查文本不覆盖结构化字段；缺失或不适用的属性按专题隔离处理并报告覆盖率。加权首发价不是 ASP。
- `model-master.js`（浏览器和 Node 共用）使用 SalesSeries.readCSV 通用解析器，提供 parse/load、get/resolve/getSeries/getPredecessor、enrich/audit；索引标准名称、分号分隔别名、永久 ID 及品牌+系列。ID 或跨机型名称冲突阻止主数据加载，不自动猜测；数值/日期缺失或格式错误单独保留为空，审计报告，不修改源文件。
- SalesSeries.sequenceIdentity 在构建周榜时统一使用永久 `model_id`，未关联的机型使用保留前缀 `unmatched:` 加规范化名称；原始榜单名称留在 raw_model。派生数据采用 sequence_id、model_id（未匹配留空），删除旧 model_key 字段，不做旧配置迁移。同一期榜单若多个原始名称指向同一身份，拒绝该研究序列，避免重算和重复累计；原始历史读取仍独立。尚未补录的新机型不丢弃。
- 机型主数据异步独立加载，等待首次读取结果后构建研究序列；失败时保留历史读取并以未匹配标识提供销量研究，不保存临时配置，允许重试。重试成功清除临时选择/分组，重新构建。研究配置 research v2、发布方案 publication v3，旧版本不迁移。
- 移除硬编码 iPhone 名称主键及预设；默认机型取最新有效榜单中的符合研究口径的前五（不足时补足），系列/版本预设按当前选择的首个可识别品牌及符合覆盖率的机型生成，代际预设依据明确 predecessor_id，允许前代未收录；保留手动分组。固定组统计仍严格处理缺失，不自动缩减成员。尚未实现价格、芯片等新专题。
- `weekly-panel-v2` 在浏览器与构建侧共用身份逻辑；派生 CSV 和研究导出携带主数据版本指纹，生成清单 schema v2 增加主数据及关联代码 SHA-256。构建要求有效主数据，防止错误发布。新增 JS 与 CSV 均仅在 /studio/ 白名单下提供。未执行构建、测试或线上验收。
