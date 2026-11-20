# 模块3架构与派生数据
- sales-estimator.html：页面结构；sales-estimator.js：标定及原始榜单 UI。
- sales-estimate-archive.js：历史存档、研究交互与专题指标；sales-series.js：纯 CSV 校验和周序列计算，浏览器及 Node 共用。
- research-charts.js：折线比例与点段数据共享，SVG 预览保留 tooltip，Canvas 导出；堆叠、流向、柱状及散点共用 Canvas 渲染。
- sales-poster.js：海报几何、模板、水印、布局审计；sales-studio.js：发布操作及冻结快照。
- studio-preferences.js：版本化本地配置；不存原始 CSV、身份凭证或研究数据快照。研究参数与分组自动保存，可清除；视觉偏好自动保存；发布方案显式保存/恢复，数据变化时不复用旧统计文案。
- studio-assets.mjs：构建与 Worker 共用公开/受保护资源名单。新增生成物仅经 /studio/ Access 校验后可访问。

## 派生 CSV
原始事实数据为 sales-estimates.csv；页面实时计算，不依赖离线派生文件。默认口径覆盖率 80%、首次观测分母、最长 3 周、门槛约束插补。每次 Cloudflare 构建自动生成 dist/studio/weekly-sales-panel.csv 和 weekly-sales-panel.meta.json，不写回 GitHub。清单包含源文件、算法和品牌规则 SHA-256、输出哈希、版本、参数和行数。算法逻辑变更应更新 SalesSeries.VERSION。导出 CSV 附带算法版本。
仓库内旧 weekly-sales-panel.csv 为历史快照；运行 npm run generate:panel 可显式刷新仓库副本和清单，然后按需提交。也可传入目标目录（npm run generate:panel -- <目录>）。构建不覆盖原始 CSV。生成清单不含时间戳，便于相同输入的可复现性比较。

本次更新没有运行测试或构建；人工验收需检查模块2/3访问、研究导航及恢复、图表预览/导出、重新加载配置和部署生成物。
