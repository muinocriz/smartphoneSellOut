# CHANGELOG · 更新记录

这里记录对用户可见的功能与修复。**长期有效的数据结构、视觉规范和设计决定**请参阅 [维护与设计指南](docs/MAINTAINER_GUIDE.md)，不再堆放在 README。

本项目尚未采用严格的语义化版本号；以下按提交／合并日期（UTC）归纳重要变更，并链接相关 PR 或提交。

## 2026-11-20

### 榜单估算历史数据库与图文复用（模块 3）

- [908cebc](https://github.com/muinocriz/smartphoneSellOut/commit/908cebc86dafc975e8e325ff7e1c115ec1c570ac) **正式历史存档**：新增 `sales-estimates.csv` 与 `sales-estimate-archive.js`；支持周榜、月榜、自定义日期范围及非固定 TOP 规模（截图识别支持 2–100 条柱条），区分标称 TOP 数和实收条数。按来源、榜单系列、周期类型和周期标识整期数据，不补零；同一期修订须确认整期替换。
- 自动读取仓库历史、导入本地标准 CSV、合并并导出完整历史文件；维护者提交同名 CSV 后实现跨设备读取。仓库读取失败时不视为空数据库，防止覆盖历史。本期明细、原标定报告、派生分析继续独立导出，发布 ZIP 新增标准销量 CSV。
- [de18b80](https://github.com/muinocriz/smartphoneSellOut/commit/de18b80362d0b0942d3b5cfca476bebf65879e6f) / [3545ca4](https://github.com/muinocriz/smartphoneSellOut/commit/3545ca4a3b616136f08f3be0d871162873c0a0fd) **可读榜单 ID**：保留中文名称，仅转义分隔符与转义字符；开发阶段不再兼容旧 URL 编码 ID。
- [84e4ded](https://github.com/muinocriz/smartphoneSellOut/commit/84e4ded0ce8a983ec5f060db063d4be5abbe63cc) **修复历史加载失败**：按实际日期和数值校验，接受表格软件保存的斜线日期及省略末尾零的万台数，重新规范化导出；增加异常行提示、刷新仓库历史按钮、缓存规避与下拉框加载状态。
- [ddae03a](https://github.com/muinocriz/smartphoneSellOut/commit/ddae03a2e3ada61899c2aad5d949378dcc00c8e9) / [e5b6487](https://github.com/muinocriz/smartphoneSellOut/commit/e5b648759af95946f362c30811d4891bd353f560) **历史榜单直接出图**：选择历史记录即可使用已存档销量、柱长、品牌系列及标定状态生成四类图卡、文案、派生 CSV 和 ZIP，无需再次上传截图或标定。历史 ZIP 保留载入并规范化后的存档字段与原保存时间；当前截图标定编辑器保持独立，可切回当前榜单。

### 榜单导入与图卡体验（模块 3）

- [2169659](https://github.com/muinocriz/smartphoneSellOut/commit/2169659ed5c809adcb1d7063dce3995b901170e1) **机型名称录入校验**：按原行号匹配排名，忽略尾部空行但保留中间空行，提示缺失、超出范围及未识别品牌的条目；刷新双机 PK 选项。
- [4f1d212](https://github.com/muinocriz/smartphoneSellOut/commit/4f1d212338e834d1cf6547a2546d7f0094c66850) / [be5b0ef](https://github.com/muinocriz/smartphoneSellOut/commit/be5b0ef0d4d1bc693b7e5b0f4e33983a8bb55d90) **展示精度统一**：结果表、历史榜单、四类图卡、概览与分析文案的估算销量统一以万台保留一位小数；差值和合计先计算后舍入，底层拟合、排名及 CSV 存储精度不变。
- [abcc4da](https://github.com/muinocriz/smartphoneSellOut/commit/abcc4da3bf870384482a377cd993fb658941d55c) / [a959ad4](https://github.com/muinocriz/smartphoneSellOut/commit/a959ad4d10943a27eb717d91d41a5948e97f46b6) **移除示例榜单**：删除两张 Base64 内嵌截图、原图查看区域、TOP40／TOP30 预设柱长数据及顶部三个旧标签；页面从空白标定编辑器启动，将唯一截图入口放在左侧上方。图片识别后释放临时 URL；历史数据从 CSV 读取。
- [a405927](https://github.com/muinocriz/smartphoneSellOut/commit/a40592735ea2c00c30ce62651646adadd03820b6) **可编辑榜单标签**：主视觉文案区在副标题下新增标签输入框，默认取历史规范榜单名或上传文件去除图片后缀的名称；换榜自动更新，可手动覆盖、清空或恢复默认，四类预览和导出共用。
- [731d5ba](https://github.com/muinocriz/smartphoneSellOut/commit/731d5ba9024c18352e2b042e6b72367e9e0ce8bf) **品牌图卡安全区**：将“系列归并”说明移至免责附注横线上方，与独立页脚同步避让底部和右侧安全区，主体图表预留说明空间。

### 市场份额与共用导出（模块 2 / 3）

- [22289cb](https://github.com/muinocriz/smartphoneSellOut/commit/22289cbf72966e7a3b7d63ce241032628406e279) **规模比例堆叠图（模块 2）**：独立堆叠图和双图组合的堆叠部分采用大盘规模指数；基准周为 100，对比周按有明确方向和百分比的环比趋势估算，否则按持平处理。按基准周份额降序排列，拆分子品牌后独立排序；实际份额数值不变。
- [d9f9fde](https://github.com/muinocriz/smartphoneSellOut/commit/d9f9fdeffeecce1603daf2a3fb1a84800a2bcdae) **可选 PNG 分辨率**：两个出图台增加 1080／1620／2160／3240px 四档宽度（默认 2160px）；独立控制导出尺寸，不改变预览与排版。模块 3 单图和 ZIP 同步使用选择的分辨率。
- [d94e479](https://github.com/muinocriz/smartphoneSellOut/commit/d94e47900801240f50f7c02a4cce7956f18c6b08) / [a55345b](https://github.com/muinocriz/smartphoneSellOut/commit/a55345bb9852b3167ce3027b3dba32ca084c02b9) 默认图片水印更新为“归零return0”，模块 3 左上角账号默认文案同步更新；数据来源声明保持独立。模块 2 调整页面标题和趋势文字颜色。

### 数据及文档

- `market-share.csv` 更新至 2026W46；`sales-estimates.csv` 首次录入 2026-W44、W45 榜单，后补充 W43，截至该日共 3 期 TOP30、90 条记录。
- 中英文 README 与维护指南同步补充历史 CSV、图文复用、展示精度和新截图导入流程。
- [4db512b](https://github.com/muinocriz/smartphoneSellOut/commit/4db512beed9c0fa45387d985676b03a2491435f7) / [8373a8e](https://github.com/muinocriz/smartphoneSellOut/commit/8373a8e7d71753fb50589a84d7a2876ecc8ed9b8) / [8b1c741](https://github.com/muinocriz/smartphoneSellOut/commit/8b1c741fa56957108566a77a6bfe6d3881b7b1d7) **文档集中校准**：按当前源码更新中英文 README 的功能与操作入口、维护指南的数据契约和长期设计规则，纠正旧堆叠图、固定导出尺寸及水印说明等过时描述；历史变更仍归本文件记录。

## 2026-11-19

### 销量追踪与完整销售周（模块 1）

- [d234c54](https://github.com/muinocriz/smartphoneSellOut/commit/d234c543a69232257ccffcae5ed7ae70be9fdb9c) **统一生命周期横轴**：按首个完整 7 天 ISO 自然周定义 W1；周一上市则当周为 W1，否则上市不足一周的部分为 P0。图表与表格共用完整销售周计算，缺失周不折算、不补零。
- [9515366](https://github.com/muinocriz/smartphoneSellOut/commit/9515366ae8ef5431634c1d89caa849f52aceaa0a) 提取共用 `iso-sales-week.js`，校验重复或无效 ISO 周；生命周期表新增 P0 天数和 P0 周末累计销量，后者不是 P0 单周增量。
- [7ffae29](https://github.com/muinocriz/smartphoneSellOut/commit/7ffae29e0470190376e6f0d87d99510daafec673) **近12周新机**：默认选择以 CSV 最新有效销量周为截止、近 12 个 ISO 周内上市且有销量记录的机型；可调整选择并保存为自定义列表快照。

### 市场份额数据化（模块 2）

- [#22](https://github.com/muinocriz/smartphoneSellOut/pull/22) 新增独立 `market-share.csv`、数据解析及导入模块；支持仓库自动读取、历史相邻周选择、最新周跟随、本地 CSV 导入、手动编辑与读取失败回退。OPPO、vivo 集团与子品牌统一去重口径，其他份额按差额补足；不与模块 1 的累计销量混用。
- [f7e59a6](https://github.com/muinocriz/smartphoneSellOut/commit/f7e59a685421ec97f2d1ecda61ed96b1e55954c1) 切换统计周时，大盘趋势卡片始终同步当前选择的 CSV 数据，避免旧编辑内容残留。
- [8e6a6d1](https://github.com/muinocriz/smartphoneSellOut/commit/8e6a6d1b1b374650542988e8ff2e9a16c9a98ac4) 哑铃图隐藏子品牌附注，简化图表标签。

### 操作台共享样式与维护（模块 2 / 3）

- [#23](https://github.com/muinocriz/smartphoneSellOut/pull/23) / [#24](https://github.com/muinocriz/smartphoneSellOut/pull/24) 引入 `studio-ui.css` 作为共用操作台样式；统一面板标题、表单、选择按钮、色卡、水印与 12／14／16／24px 四档字号；修正中英文混排、指标字重和色卡间距。
- [#25](https://github.com/muinocriz/smartphoneSellOut/pull/25) 移除模块 2 Tailwind CDN 及工具类，改用语义化 `market-share.css`，保留 SVG 海报、CSV 交互和 PNG 导出逻辑。
- [#26](https://github.com/muinocriz/smartphoneSellOut/pull/26) 两个出图台控件和首页导航统一系统 UI 字体，IBM Plex Mono 限定独立数值字段，海报和 ECharts 各自的字体规格不变。
- 补充完整销售周、CSV 数据契约、共享样式与按风险选择验收范围的维护规范；仓库增加相应日期、份额解析与样式检查代码。
- `data.csv` 补充 2026W45 七项折叠机型累计销量。

### 主题视觉系统统一（模块 2 / 3）
- 采用 `poster-themes.js` 共用六套主题，模块2 SVG 与模块3 Canvas 的主题背景、文字、边框、主辅强调色完全对应；移除第三模块独立主题色字面量和 HTML 色卡硬编码。
- 两模块统一为主题色渐变外底、白色圆角主卡、白色图表内卡，并使用共用留边／圆角／点阵规格；各自业务图表和品牌识别色保留。
- 「编辑部米白」统一为新用户默认主题；已有浏览器本地选项仍被保留。详见 [维护与设计指南](docs/MAINTAINER_GUIDE.md)。


### 文档整理
- 精简中英文 README，只保留项目入口、功能概览、快速使用与重要数据限制。
- 将详细更新记录迁移至本文件，CSV 与设计约定迁移至 `docs/MAINTAINER_GUIDE.md`。

### 图文编辑与海报

- [#19](https://github.com/muinocriz/smartphoneSellOut/pull/19) **模块 2 / 3 图片水印**：新增斜向平铺与中心单个水印；可编辑文案、透明度、字号和间距；两种模式互斥，支持本地保存、实时预览和 PNG 导出，模块 3 的 ZIP 图片也包含水印。
- [#18](https://github.com/muinocriz/smartphoneSellOut/pull/18) **模块 2 战报文案编辑**：将两周趋势卡片的标签与趋势描述移入文案编辑区；新增底部数据口径、补充说明的独立输入框。
- [#17](https://github.com/muinocriz/smartphoneSellOut/pull/17) **模块 3 白色卡片式海报**：浅灰蓝外底、圆角白色主卡、细边框和柔和阴影；TOP10 另有内层数据卡片。
- [#16](https://github.com/muinocriz/smartphoneSellOut/pull/16) **统一操作面板视觉**：模块 2 / 3 的安全区和主题设置从旧深色面板改为浅色卡片，保留蓝色选中态和红／橙安全区语义色。
- [#15](https://github.com/muinocriz/smartphoneSellOut/pull/15) **模块 3 底部安全区**：免责声明独立定位于安全线附近，减少整体缩放导致的过度底部留白。
- [#14](https://github.com/muinocriz/smartphoneSellOut/pull/14) **模块 3 滚动布局**：桌面端左侧操作栏独立滚动，右侧图卡预览保持可见；移动端改为上下排列。
- [#11](https://github.com/muinocriz/smartphoneSellOut/pull/11) **双机销量 PK**：机型名称优先单行，放不下时移除可识别的品牌前缀并自适应字号；优化卡片与倍数分析间距。

### 字体与界面

- [#13](https://github.com/muinocriz/smartphoneSellOut/pull/13) **数值字段专用字体**：纠正混排文本的过度数字拆分。现仅独立数据字段优先使用 IBM Plex Mono；日期、机型名称与普通说明文字保持正文字体。
- [#12](https://github.com/muinocriz/smartphoneSellOut/pull/12) **数字字体基础支持**：在模块 2 / 3 接入 IBM Plex Mono，并优化 SVG／Canvas 数字测量和数值左对齐。最终适用范围以 #13 为准。
- [#10](https://github.com/muinocriz/smartphoneSellOut/pull/10) **模块 2 视觉统一**：将旧深色控制台改为浅色网页界面，改善输入区、图表选择与预览舞台的视觉层级；设置面板后续由 #16 进一步统一。

### 模块集成

- [#9](https://github.com/muinocriz/smartphoneSellOut/pull/9) **新增第三模块**：上线榜单截图柱长测量、销量标定、异常校验、品牌系列分析、四类发布图卡、安全区预览，以及 PNG／CSV／ZIP 导出；首页新增第三个标签和直达链接。

### 本次开发阶段已有的基础功能

- **销量追踪**：累计销量和周增量折线、横轴切换、机型筛选、自动里程碑、我的列表、桌面／手机 PNG。
- **市场份额**：两周品牌／子品牌占比对比、五种图表、六套配色、3:4 海报和抖音安全区。
- **榜单推算**：单机或最多五机合计销量标定；支持 `782.87-689.03` 形式的累计差值输入，异常标定提示与不同榜单独立计算。

> 以上列出重要变化而非逐行代码差异。具体实现、已有测试记录及当时的限制，请参阅对应 PR 或提交；常规数据维护合并记录，不逐条列出机型销量。
