# smartphoneSellOut · 手机销量数据可视化

[简体中文](README.md) · [English](README.en.md)

一个基于 GitHub Pages 的静态手机销量分析与图文制作项目。**无需后端、无需构建**，包含销量追踪、市场份额和榜单推算三个独立模块。

**[在线打开项目](https://muinocriz.github.io/smartphoneSellOut/)**

<p align="center">
  <img src="screenshots/新机周销量-26折叠-发布后-总销量-桌面.png" alt="销量追踪桌面预览" width="760">
</p>

## 功能与入口

| 模块 | 用途 | 进入 |
| --- | --- | --- |
| **01 · 销量追踪** | 查看选定机型的累计销量、周增量、趋势和数据表；支持筛选、收藏及桌面/移动端 PNG 导出。 | [打开销量追踪](https://muinocriz.github.io/smartphoneSellOut/) |
| **02 · 市场份额** | 自动读取 `market-share.csv`，选择连续两周品牌份额，支持本地 CSV 导入与手动编辑；五种图表、六套主题和 3:4 PNG 导出。 | [打开市场份额](https://muinocriz.github.io/smartphoneSellOut/#market-share) |
| **03 · 榜单推算与出图** | 从不同规模的柱状图榜单和已知销量估算入榜机型销量；读取历史 CSV、合并存档并制作四类图卡。 | [打开榜单推算](https://muinocriz.github.io/smartphoneSellOut/#sales-estimator) |

## 快速使用

访问上方在线入口即可使用。若需在本地运行，克隆或下载仓库后，在项目根目录执行：

```bash
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

直接双击 `index.html` 可能受到浏览器本地文件读取限制；推荐使用本地服务器。

## 数据更新

- **模块 1**：编辑根目录 `data.csv`，新增一周只需追加周列；CSV 存储的是**累计销量**（单位：万台），周销量由相邻周差分计算。
- **模块 2**：编辑根目录 `market-share.csv`，每周追加一行 `ISO 周,趋势,苹果,华为,小米,OPPO,一加,realme,vivo,iQOO,荣耀`；网页自动加载仓库 CSV，也可导入本地 CSV、选择相邻两周或手动修改。OPPO **集团份额已包含**一加与 realme，vivo **集团份额已包含** iQOO，**不要重复相加**；其他按 `100%－六大集团合计` 补足。原有 `data.csv` 仅供模块 1 使用。
- **模块 3**：导入榜单截图并录入同口径已知销量进行标定，填写来源、榜单系列与统计周期，标称 TOP 数可留空；实际条目数自动识别。页面读取独立的 `sales-estimates.csv`，点击“合并本期并导出完整历史 CSV”，将下载的同名文件提交到仓库根目录。相同来源、系列、周期整期替换前需确认；不同规模不需补零。刷新前下载未提交的数据，必要时导入历史 CSV 恢复。仅保存正式估算结果，不保存截图或完整标定工作区，不混用 `data.csv`。

CSV 字段、设计约定、部署和维护方法见 [维护与设计指南](docs/MAINTAINER_GUIDE.md)。

## 数据来源与使用说明

销量追踪数据主要根据 **RD观测**、**数码闲聊站** 等公开内容人工整理，仅供学习与参考，不代表官方统计。**模块 1 是选定机型样本，不是全市场销量总榜；模块 2 默认加载仓库中的可编辑份额 CSV（非官方实时统计），读取失败时回退到本地保存或示例数据；模块 3 的推算仅适用于当前截图的入榜样本，不代表品牌全市场份额。** 发布前请自行核实统计周期、品牌口径及原始数据。

## 更多文档

- [CHANGELOG.md](CHANGELOG.md)：功能更新与问题修复记录。
- [维护与设计指南](docs/MAINTAINER_GUIDE.md)：数据格式、图卡规格、设计原则和开发维护说明。

**致谢**：感谢 [@zhoulin12138](https://github.com/zhoulin12138) 提供的思路、辅导与支持。
