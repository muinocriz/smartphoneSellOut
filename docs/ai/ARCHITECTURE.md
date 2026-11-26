# 架构与数据流

三个模块是独立 HTML 文档，根目录直接运行。旧版销量追踪模块页面已下线，index.html 仅负责默认跳转销量增量追踪模块及兼容仍有效的旧首页 hash 链接。页面以普通 script 按顺序加载依赖，销量数据处理模块的核心逻辑有相当部分内联在 HTML。共享外壳 site-shell.js 生成导航、同步主题。外观偏好存 localStorage，主题切换发出 `site-theme-change`。函数入口见 [代码索引](CODE_MAP.md)。

## 输入、派生和持久化

| 模块 | 仓库输入 | 计算和输出 |
| --- | --- | --- |
| 热销机型与榜单研究模块 | 截图标定 → sales-estimates.csv；model-master.csv 关联身份；按专题读取 sales-long.csv、market-share.csv | 原始排名 → 历史与研究；扩展模式融合跟踪销量。研究结果进入网页预览、工作台发布快照，再导出 PNG、CSV 或 ZIP。构建派生的 weekly-sales-panel 与浏览器即时计算分别生成。 |
| 销量数据处理模块 | sales-long.csv、model-master.csv；可预览同步项目 data.csv 或本地宽表，或导入销量增量追踪模块会话草稿 | 编辑累计/周增量、特殊值及主数据；冲突确认、撤销/重做、本地草稿。导出长表或机型表后由维护者提交相应 CSV。 |
| 销量增量追踪模块 | sales-long.csv，区分累计/周增量及运算符 | 自然周/完整销售周对比、缺周估算、选中机型表格编辑；导出 PNG/长表；可把编辑结果交给销量数据处理模块。 |

旧版销量追踪模块的 data.csv 保留并继续公开发布，作为销量数据处理模块的可选宽表导入源；不再接收旧版销量追踪模块会话草稿。市场份额模块的独立页面已下线。`market-share.csv`（每周品牌份额和大盘趋势）和 `market-share-data.js` 保留为热销机型与榜单研究模块的数据层，由 `ensureMarketData` 直接读取与校验；维护者继续提交根目录 CSV。生产保留根路径及 `/studio/` 数据副本，不改变公开访问策略。

销量增量追踪模块的临时编辑通过当前标签页的 sessionStorage（SalesSite）交给销量数据处理模块；销量数据处理模块自身可恢复本地草稿，离开页面时将相较导入基准有变化的销量长表和周列表放入当前标签页的会话存储。销量增量追踪模块顶部可从项目、本地文件或该会话更新导入，成功接收后标记该版本已导入。刷新、跨页返回、导出文件、提交正式数据是不同操作。处理数据同步时同时定位生产者、接收者与确认写入路径。榜单估算表 sales-estimates.csv 与跟踪长表 sales-long.csv 各自独立。

热销机型与榜单研究模块出图台排版覆盖值随 `StudioPreferences` 的 visual / publication 本地保存；公共元素跨图卡共享，主体按模板或研究专题隔离，缺省继承原渲染器。发布快照冻结排版配置，与 PNG、ZIP 同步；排版 JSON 仅含视觉设置。专题研究页直接导出不受出图台排版覆盖值影响。出图台仅编辑图卡内文字，不再生成独立社媒发布文案、标题或轮播脚本；发布 ZIP 保留图卡、CSV、统计说明和配置清单。旧 visual / publication 存储迁移时保留图卡设置并移除已退役字段。

## 运行、发布与验收

- 本地在仓库根目录执行 `python3 -m http.server 8000`，访问 `http://localhost:8000/`（跳转销量增量追踪模块）；热销机型与榜单研究模块本地入口为 `/sales-estimator.html`。本地静态预览无需构建。
- Cloudflare Workers 与 GitHub Pages 共用静态构建清单。根 package.json 的 `npm run build` 调用 scripts/build-cloudflare.mjs，根据 studio-assets.mjs 清单生成 dist/；构建时改写首页兼容跳转、热销机型与榜单研究模块导航与共享外壳相对路径，并生成榜单面板。热销机型与榜单研究模块使用站点相对路径 `studio/sales-estimator.html`。GitHub Pages 由 `.github/workflows/pages.yml` 独立发布 `dist/`。修改资源依赖时核对发布清单；部署细节见 [部署指南](../CLOUDFLARE_DEPLOYMENT.md)。
- 项目以用户手动验收为主，package.json 无 test 脚本。维护者可从受影响页面打开相应 CSV、操作对应控件，并核对页面或导出结果；仅按 [工作约定](../../AGENTS.md) 中的授权执行测试。