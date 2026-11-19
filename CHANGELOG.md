# CHANGELOG · 更新记录

这里记录对用户可见的功能与修复。**长期有效的数据结构、视觉规范和设计决定**请参阅 [维护与设计指南](docs/MAINTAINER_GUIDE.md)，不再堆放在 README。

本项目尚未采用严格的语义化版本号；以下按合并日期和 PR 记录重要变更。

## 2026-11-19

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

> 以上列出重要变化而非逐行代码差异。每项的具体实现、测试记录和当时的限制，请点击对应 PR。
