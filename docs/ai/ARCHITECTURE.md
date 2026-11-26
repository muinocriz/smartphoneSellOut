# 架构与数据流

五个模块是独立 HTML 文档，根目录直接运行。页面以普通 script 按顺序加载依赖，模块 1、2、4 的核心逻辑有相当部分内联在 HTML。共享外壳 site-shell.js 生成导航、转换旧首页 hash 链接、同步主题。外观偏好存 localStorage，主题切换发出 `site-theme-change`。函数入口见 [代码索引](CODE_MAP.md)。

## 输入、派生和持久化

| 模块 | 仓库输入 | 计算和输出 |
| --- | --- | --- |
| 1 销量追踪 | data.csv，机型累计宽表，周列单位万台 | 按机型、自然周或销售周绘图；相邻观测差分、区间内可选估算。临时编辑可导出完整宽表，图上插补不写回。 |
| 2 市场份额 | market-share.csv，每周品牌份额和大盘趋势 | 选择基准周和对比周，计算份额差及规模比例，生成 SVG 海报和 PNG。支持本地导入与手动调整。 |
| 3 热销机型与榜单研究 | 截图标定 → sales-estimates.csv；model-master.csv 关联身份；按专题读取 sales-long.csv、market-share.csv | 原始排名 → 历史与研究；扩展模式融合跟踪销量。研究结果进入网页预览、工作台发布快照，再导出 PNG、CSV 或 ZIP。构建派生的 weekly-sales-panel 与浏览器即时计算分别生成。 |
| 4 销量数据处理 | sales-long.csv、model-master.csv；可预览同步 data.csv、模块 1 修改后的宽表，或导入模块 5 会话草稿 | 编辑累计/周增量、特殊值及主数据；冲突确认、撤销/重做、本地草稿。导出长表或机型表后由维护者提交相应 CSV。 |
| 5 销量增量追踪 | sales-long.csv，区分累计/周增量及运算符 | 自然周/完整销售周对比、缺周估算、选中机型表格编辑；导出 PNG/长表；可把编辑结果交给模块 4。 |

模块 1、5 的临时编辑通过当前标签页的 sessionStorage（SalesSite）交给模块 4；模块 4 自身可恢复本地草稿。刷新、跨页返回、导出文件、提交正式数据是不同操作。处理数据同步时同时定位生产者、接收者与确认写入路径。榜单估算表 sales-estimates.csv 与跟踪长表 sales-long.csv 各自独立。

模块 3 出图台排版覆盖值随 `StudioPreferences` 的 visual / publication 本地保存；公共元素跨图卡共享，主体按模板或研究专题隔离，缺省继承原渲染器。发布快照冻结排版配置，与 PNG、ZIP 同步；排版 JSON 仅含视觉设置。专题研究页直接导出不受出图台排版覆盖值影响。

## 运行、发布与验收

- 本地在仓库根目录执行 `python3 -m http.server 8000`，访问 `http://localhost:8000/`；模块 3 本地入口为 `/sales-estimator.html`。本地静态预览无需构建。
- 生产走 Cloudflare Workers。根 package.json 的 `npm run build` 调用 scripts/build-cloudflare.mjs，根据 studio-assets.mjs 清单生成 dist/；构建时改写模块 3 导航与共享外壳相对路径，并生成榜单面板。线上入口为 `/studio/sales-estimator.html`。修改资源依赖时核对发布清单；部署细节见 [部署指南](../CLOUDFLARE_DEPLOYMENT.md)。
- 项目以用户手动验收为主，package.json 无 test 脚本。维护者可从受影响页面打开相应 CSV、操作对应控件，并核对页面或导出结果；仅按 [工作约定](../../AGENTS.md) 中的授权执行测试。