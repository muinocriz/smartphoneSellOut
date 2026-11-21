# CHANGELOG · 更新记录

这里记录对用户可见的功能与修复。**长期有效的数据结构、视觉规范和设计决定**请参阅 [维护与设计指南](docs/MAINTAINER_GUIDE.md)，不再堆放在 README。

本项目尚未采用严格的语义化版本号；以下按提交／合并日期（UTC）归纳重要变更，并链接相关 PR 或提交。

## 2026-11-21

### 模块 3 属性筛选与自动分组

- 删除促销区间对比及活动区间参数、统计、发布入口，现有研究九项。
- 新增受保护的 `product-research.js`，共享属性筛选及自动分组；系列/结构支持固定成员和当期原始入榜，代际按前代关系选择单机或系列，保留手动编辑。机型 CSV 与图卡使用相同筛选后选择。
- 研究配置 v3、发布方案 v4，旧版不迁移，视觉偏好保留。原始 CSV 不变，未运行构建或测试。

### 模块 3 统一机型主数据关联

- 新增受保护的 `model-master.js`，浏览器与 Node 共用解析、索引、标准名称/别名精确关联、属性查询及审计。主数据独立加载，失败不阻塞历史记录；未匹配机型保留独立标识，同榜重复身份不合并也不重复计量。
- 研究序列使用永久 `model_id`；派生面板改用 `sequence_id` 与 `model_id`，保留 `raw_model`，移除旧名称主键及 iPhone 硬编码预设。默认机型、系列/版本和前代关系从当前数据生成，手动分组保留。
- 派生算法升级 weekly-panel-v2，生成清单 schema v2 记录主数据与关联算法哈希；研究配置升至 v2、发布方案 v3，无旧版迁移。原始 CSV 不变，未执行测试、构建或部署验收。

### 模块 3 机型主数据准备

- 新增 `model-master.csv`，初始版本包含 53 个机型及合并统计项、19 个字段，保存机型固定标识、别名、系列、正式开售日期、代际、首发价、芯片归类、起售 RAM/ROM 与来源备注。主数据独立维护，暂未接入网页研究计算。
- 文件仅列入 `protectedFiles`，构建复制到 `/studio/model-master.csv`，沿用模块 3 Access 与 Worker JWT 校验；不在公开根路径发布。实际部署与访问权限尚待维护者验收。
- [4f95eaf](https://github.com/muinocriz/smartphoneSellOut/commit/4f95eaf) 将 `data.csv` 的 iPhone 17 系列日期由预购日 2025/9/12 修正为正式开售日 2025/9/19；`date` 字段按正式开售日维护。

### 模块 2 公开访问

- [8480289](https://github.com/muinocriz/smartphoneSellOut/commit/8480289) 模块 1／2 无需登录，市场份额页面、CSV 和依赖由根路径公开提供；模块 3 及历史销量、衍生数据继续受 /studio/* Access 与 Worker JWT 校验保护。
- 保留 /studio/market-share.csv 等兼容副本供模块 3 跨模块研究使用，原始 CSV 仍统一在仓库根目录维护。
- 更新中英文 README、维护与部署指南；未执行构建、测试及线上验收。

### 销量追踪、数据与图卡体验

- [bcfd732](https://github.com/muinocriz/smartphoneSellOut/commit/bcfd732) 修正历史 CSV 中小米 18 系列名称的空格写法，不改变估算销量。截至本次文档基线，W38–W45 共 8 期、239 条源记录（W40 为 TOP29，其余各 30 条）；此为文件行数统计，不代表运行验收。
- [b1c5da4](https://github.com/muinocriz/smartphoneSellOut/commit/b1c5da4) 模块1禁用鼠标滚轮及触控板滚动缩放。
- [ab235e0](https://github.com/muinocriz/smartphoneSellOut/commit/ab235e0) / [e7166ab](https://github.com/muinocriz/smartphoneSellOut/commit/e7166ab) 模块2移除区块编号，PNG 导出独立为 CSV 数据区之后的同级面板。
- [e4b5b42](https://github.com/muinocriz/smartphoneSellOut/commit/e4b5b42) / [33b5e40](https://github.com/muinocriz/smartphoneSellOut/commit/33b5e40) 两个图卡工作台统一抖音安全区控件和独立规避行为，右侧默认 13%、底部默认 10%，参考线仅供预览。
- [be331ee](https://github.com/muinocriz/smartphoneSellOut/commit/be331ee) 共用 `poster-export.js`：分辨率、作业状态、字体等待、Blob 导出和下载重试集中管理；模块各自保留 SVG／Canvas 渲染和发布数据。
- [5294e24](https://github.com/muinocriz/smartphoneSellOut/commit/5294e24) / [2868eee](https://github.com/muinocriz/smartphoneSellOut/commit/2868eee) 导出按钮统一静态文案“导出”；启用安全区时新增“多版本导出”，同一发布快照输出规避版、完整版两张 PNG，串行渲染，提供分别下载入口。
- [f0a1423](https://github.com/muinocriz/smartphoneSellOut/commit/f0a1423) / [40a9836](https://github.com/muinocriz/smartphoneSellOut/commit/40a9836) / [7341917](https://github.com/muinocriz/smartphoneSellOut/commit/7341917) 精简预览说明、标题、附注及状态标签；质量提示仅在有实际问题时展示，调整专题和图卡编辑文案。

### 模块 3 历史 CSV 初始化回归修复

- [7341917](https://github.com/muinocriz/smartphoneSellOut/commit/7341917) 精简提示元素后遗留 `trackerParameterHint` 和 `.panel-desc` 两处 DOM 依赖，可能导致脚本初始化中断。
- [e55eded](https://github.com/muinocriz/smartphoneSellOut/commit/e55eded) 删除残留文本操作；历史 CSV 读取先启动，专题研究与估算存档改为独立初始化函数；研究、工作台同步及估算控件更新分别捕获异常，避免研究失败阻断历史读取。历史榜单显示不再依赖专题初始化或工作台销量格式化函数。仍保留单文件、共享历史状态和现有业务接口，不是完整物理模块拆分。
- [2cb2c2f](https://github.com/muinocriz/smartphoneSellOut/commit/2cb2c2f) 将专题导航挂载到保留的标题 `h2` 后方，移除已删除说明的筛选引用。上述修复未执行自动或线上运行测试。

## 2026-11-20

### 热销机型研究与图文工作台（模块 3）

- [437fead](https://github.com/muinocriz/smartphoneSellOut/commit/437fead) 模块1导出图的网址水印更新为 Cloudflare Workers 生产域名。
- [f2d4225](https://github.com/muinocriz/smartphoneSellOut/commit/f2d4225) 补充 W38 起历史榜单数据，为 iPhone 17 系列同期销量研究提供估算依据。
- [0d471b9](https://github.com/muinocriz/smartphoneSellOut/commit/0d471b9) / [e98bd84](https://github.com/muinocriz/smartphoneSellOut/commit/e98bd84) / [5b3ff4d](https://github.com/muinocriz/smartphoneSellOut/commit/5b3ff4d) 新增热销机型追踪、归一化机型标识、连续 ISO 周面板；支持不同规模榜单（含 TOP29）、短期缺失插补与动态末名门槛；四个功能 Tab 独立切换。
- [8047605](https://github.com/muinocriz/smartphoneSellOut/commit/8047605) / [09a6d49](https://github.com/muinocriz/smartphoneSellOut/commit/09a6d49) 支持研究区间、覆盖率分母、原始／插补模式、最大缺失周数、整周缺榜及末周估算开关；自定义机型分组、同档代际配对与固定 TOP K 原始样本比较。
- [7d93e72](https://github.com/muinocriz/smartphoneSellOut/commit/7d93e72) / [682bb6e](https://github.com/muinocriz/smartphoneSellOut/commit/682bb6e) / [c46b770](https://github.com/muinocriz/smartphoneSellOut/commit/c46b770) 研究专题接入图文工作台，支持高清图卡与专题 CSV、文案打包；新增跨模块品牌头部效应、全市场对比、品牌份额堆叠、双周流向及 CR／HHI 集中度分析。
- [de39b5e](https://github.com/muinocriz/smartphoneSellOut/commit/de39b5e) / [623b6ed](https://github.com/muinocriz/smartphoneSellOut/commit/623b6ed) 统一母品牌聚合、各专题独立分组、有效统计区间和附注；发布数据以冻结快照为准。专题按产品销量研究、榜单生态研究、跨模块研究分类，共十项。
- [f5827d4](https://github.com/muinocriz/smartphoneSellOut/commit/f5827d4) / [cf13b6a](https://github.com/muinocriz/smartphoneSellOut/commit/cf13b6a) / [0ae61dd](https://github.com/muinocriz/smartphoneSellOut/commit/0ae61dd) 安全区改为独立横纵留白而非整体缩放；移除工作台步骤编号、调整设定位置、修复安全区焦点滚动。

### 共用实现、代码清理与发布基础设施

- [74120cd](https://github.com/muinocriz/smartphoneSellOut/commit/74120cd) 修复公共品牌工具的私有部署白名单及模块2 CSV 初始化错误提示；[0cf6297](https://github.com/muinocriz/smartphoneSellOut/commit/0cf6297) 极简纯白主题改为红涨绿跌。
- [dd36f96](https://github.com/muinocriz/smartphoneSellOut/commit/dd36f96) 拆分模块3标定、图卡渲染、工作台、数据引擎与图表；新增版本化研究／视觉／发布方案、本地配置和可复现派生数据构建。浏览器与 Node 共用 `sales-series.js`，构建生成受保护的周销量面板与元数据清单。
- [99e047b](https://github.com/muinocriz/smartphoneSellOut/commit/99e047b) / [50125ca](https://github.com/muinocriz/smartphoneSellOut/commit/50125ca) 移除过时界面、仓库根目录派生快照及 `tests/`，清理旧兼容并保留可编辑文案；模块2不再内置示例份额。
- [b2fa4f4](https://github.com/muinocriz/smartphoneSellOut/commit/b2fa4f4) / [475856f](https://github.com/muinocriz/smartphoneSellOut/commit/475856f) / [d66291b](https://github.com/muinocriz/smartphoneSellOut/commit/d66291b) / [11d7601](https://github.com/muinocriz/smartphoneSellOut/commit/11d7601) 精简模块2／3标题、说明及状态标签，统一主题 ID、渲染入口与按版本读取本地配置，移除旧配置迁移。
- [f4043ce](https://github.com/muinocriz/smartphoneSellOut/commit/f4043ce) / [e5a9c01](https://github.com/muinocriz/smartphoneSellOut/commit/e5a9c01) / [0b200f4](https://github.com/muinocriz/smartphoneSellOut/commit/0b200f4) / [112bf13](https://github.com/muinocriz/smartphoneSellOut/commit/112bf13) 统一水印默认值、控件和渲染参数，复用份额 SVG 组件、涨跌样式、双周堆叠几何、海报主卡几何和数字字体分词，合并共享表单 CSS 及清理覆盖声明。

### Cloudflare 分模块访问部署

- 新增 Cloudflare Workers 资产白名单构建、独立 /studio/ 受保护路径及服务端 Access JWT 校验；模块 1 保持公开，模块 2／3 页面及 CSV 只在授权路径提供。缺少配置时私有路径默认拒绝。
- 首页保留原标签并增加授权状态检查和顶层登录入口；本地开发操作不受影响。保留三个 CSV 原始维护路径，部署不包含开发文档和测试。
- 新增 Cloudflare 部署指南；部署代码提交时尚未执行线上验收。
- **部署迁移完成（维护者确认）**：生产入口更新为 [Cloudflare Workers](https://smartphonesellout.zirconium.workers.dev/)；GitHub 仓库已确认转为 Private，旧 GitHub Pages 由维护者关闭。维护者确认公开首页正常、两个 `/studio/` 私有 CSV 在无痕未登录状态下要求认证，并确认指定邮箱 Access 验证成功。同步更新中英文 README、维护指南及部署指南。此次文档更新未独立取得线上 HTTP 响应，也未执行完整的历史部署／会话过期验收。

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
