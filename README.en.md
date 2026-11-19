# Smartphone Sales, Market Share & Ranking Estimator · smartphoneSellOut

[简体中文](README.md) | English

A static, no-backend, no-build smartphone market visualization project with three homepage tabs: **销量追踪** (Sales Tracking, default), charting cumulative and weekly smartphone sell-out; **市场份额** (Market Share), comparing two weeks of brand shares; and **榜单推算与出图** (Ranking Estimator & Poster Studio), estimating in-chart smartphone sales from screenshot bar lengths calibrated against known sales. Each tab has its own data: only Sales Tracking reads `data.csv`. The other tools use data edited within their own pages.

Live site: <https://muinocriz.github.io/smartphoneSellOut/>

## Updates — November 19, 2026

- **Three homepage tabs**: `index.html` switches between Sales Tracking (default), Market Share and Ranking Estimator & Poster Studio. The latter two are separate files (`market-share.html` and `sales-estimator.html`); direct links: [Market Share](https://muinocriz.github.io/smartphoneSellOut/#market-share) and [Ranking Estimator](https://muinocriz.github.io/smartphoneSellOut/#sales-estimator).
- **New market-share poster studio**: compare two weeks, edit brand/sub-brand shares, choose among five charts and six colour themes, preview TikTok/Douyin safe areas, and export a 1200×1600 PNG.
- **Refreshed poster palettes**: retired 暗夜红蓝 (OLED Red/Blue), 深海金融 (Deep Finance), 黑金奢华 (Black-Gold Luxury), and the interim 极光科技 (Aurora Tech) theme. Added 柔雾丁香 (Soft Lilac), 雾蓝极简 (Mist Blue Minimal), and 日落珊瑚 (Sunset Coral), while keeping 编辑部米白 (Editorial Ivory), 极简纯白 (Pure White), and 莫兰迪绿野 (Morandi Sage). Soft Lilac is now the default.
- **Existing sales features preserved**: model filters, saved lists, sell-out charts, data tables, and desktop/mobile PNG exports remain available.

## Ranking estimator & poster studio (third module)

Open **榜单推算与出图** on the homepage or [go directly to the third tab](https://muinocriz.github.io/smartphoneSellOut/#sales-estimator).

- **Bar-length measurement**: includes example September 2026 TOP40 and W45 TOP30 screenshots, and supports importing similar horizontal blue-bar ranking screenshots with manually editable model names.
- **Calibration**: enter sales for one model or the combined sales of up to five models. You can input a cumulative-sales difference such as `782.87-689.03`. Conflicting calibration groups are flagged, and each ranking is calibrated independently.
- **Visual publishing**: four poster types (TOP10, two-model comparison, brand-family ranking and leader gap), six themes, 3:4 or 9:16 export, separate right/bottom Douyin safe areas, customizable titles, captions, brand marks and footnotes, plus CSV/ZIP exports.
- **Editable poster copy**: clearing the last character from a field keeps it blank, rather than restoring a default. Defaults return only when the reset button is clicked.

> **Data scope**: bar charts without an axis scale give relative proportions, not absolute sales. Provide a known, consistent sales reference before publishing estimated volumes. Brand-family totals describe only the **models present in the screenshot**, never full-market brand sales or market share. Example rankings do not sync with `data.csv` and are not official statistics.

## Market-share poster studio

Select the **市场份额** tab on the homepage to access:

- **Five visualization modes**: combined 100% stacked share + diverging change chart, diverging horizontal bars, 100% stacked chart, slope chart, and dumbbell chart.
- **Editable weekly shares**: open the data editor to change week labels, market notes, and individual brand/sub-brand percentages. The “Other” category is calculated as the remaining share. OPPO can be split into OnePlus/realme and vivo into iQOO.
- **Six poster colour palettes**: Soft Lilac (default), Editorial Ivory, Pure White, Mist Blue Minimal, Sunset Coral, and Morandi Sage. Customize headline, subtitle, and insight text.
- **Douyin safe-area preview**: separately adjust right-side and bottom exclusion zones; guide overlays are not included in exported images.
- **High-resolution export**: 3:4 portrait poster saved as a 1200×1600 PNG. Edits persist in this browser's `localStorage`; sample values can be restored.

> **Data disclaimer:** The market-share studio starts with editable sample W44/W45 values, **not live or verified market-share statistics**. It does not automatically sync with `data.csv` or an external data service. Verify the dates, brand grouping, figures, and sources before publishing.

## Sales-tracking data sources

- Primary source: Weibo blogger **RD观测** (RD Observation)
- Secondary source: Weibo blogger **数码闲聊站** (Digital Chat Station)

The author compiled and entered the figures by hand from these bloggers' public posts. They are for personal study and reference only and are not official data. All rights to the data belong to the original authors.

## Sales-tracking features

- **Brand / model filter**: pick a brand, then select any number of its models. Choose 「全部」 (All) to compare across brands; it starts with each brand's model with the largest gain in the latest week.
- **Names at line ends**: there is no legend. Each line's model name is written at its end, in the line's colour. Names avoid other lines and value labels automatically; names that don't fit are shown faded, and hovering the line reveals them.
- **Data labels**: every point on a line shows its value. Overlapping labels are hidden automatically, and you can turn all labels off. They are off by default on phones.
- **PNG export**: two buttons at the top right of the chart export the currently selected models and week range.
  - 🖥️ Desktop: 16:9, 2400×1350.
  - 📱 Mobile: 4:5 portrait, 1200×1500, with numbers at the line ends and a list below the chart ranked by latest value.
  - Lines with no room for a name or number are drawn in light grey, and their count is noted.
- **Phone layout**: on screens up to 600px wide, the on-page chart uses the same style as the mobile export. Tap a list item to highlight its line.
- **Week range**: drag the slider under the chart, use the start/end week dropdowns, or scroll the mouse wheel over the chart to change which weeks are shown. On phones and tablets you can't drag or pinch on the chart to zoom, so that swiping over it still scrolls the page; use the slider or the dropdowns instead.
- **Two x-axis modes**:
  - Calendar week: weeks in order (W34, W35, …).
  - Week N after launch: the week containing the launch date counts as week 1, so you can compare models that launched at different times.
- **Two value modes**: cumulative sales (累计销量), or week-over-week change (this week minus last week).
- **Log y-axis**: useful when models differ greatly in scale, for example iPhone alongside other models.
- **Data table**: the values for the selected models are listed below the chart, with the same columns as the chart's x-axis but in reverse order, so the latest week is on the left.
- **Anomaly hints**: if a model's value is lower than the week before, the page flags it as a possible data-entry error. Models without a launch date are left out of the "week N after launch" view, and the page lists their names.
- **This week's milestones (本周里程碑)**: the saved-lists row starts with an automatic collection, 「🏁 本周里程碑」, containing models whose cumulative sales crossed a multiple of 500,000 units (50 万台: 50, 100, 150, …) in the latest week. Click it to view them; the note under the chart says which milestone each one passed, and hovering the button shows the details. It updates with the data and can't be renamed or deleted.
- **Saved lists (我的列表)**: save a set of models you often check as a template and restore it with one click.
  - New lists are named 「用户列表1」, 「用户列表2」, … (User list 1, 2, …), and you can rename them directly.
  - You can update a list's models or delete the list (deleting takes a second click to confirm).
  - Lists are stored in this browser's localStorage. They are not available on another device or browser, or after the browser's site data is cleared. Use the Export / Import buttons (导出 / 导入) to save lists as a JSON file for backup or to move them to another browser.

## Updating sales-tracking data

For the Sales Tracking tab, edit `data.csv` and commit. GitHub Pages updates within a minute or two. You don't need to change `index.html`.

### CSV format

```csv
brand,model,category,date,2026W34,2026W35,...
华为,Pura 90系列,旗舰SO,2026/5/9,128.82,134.06,...
```

| Column | Description |
| --- | --- |
| `brand` | Brand. Required |
| `model` | Model. Required. Must be unique within a brand. Don't prefix it with the brand (write `17系列`, not `小米 17系列`); the page adds the brand where needed |
| `category` | Category. Optional; shown when you hover over a model |
| `date` | Launch date. Recommended. `2026/5/9` or `2026-05-09`. Without it, the model does not appear in the "week N after launch" view |
| Week columns | Name them `2026W34` (recommended, so weeks line up correctly across years) or `W34`. Week columns without a year use `DEFAULT_YEAR` in `index.html` |

- Leave a cell empty when there is no data. The line breaks there instead of dropping to 0.
- To add a new week, add a column at the end. The page picks it up automatically.
- UTF-8 and GBK encodings both work, so a CSV saved straight from Excel is fine.

> Note: saved lists identify each model by `brand + model`. If you rename a model in the CSV, any list that includes it will say the model is not in the current data. Select the models again and click 「用当前选择更新」 (Update with current selection).

## Updating market-share data

In the **市场份额** tab, open **录入 / 修改份额数据** → **展开编辑表格** to enter the weekly percentages. The chart updates immediately and your changes are saved locally in that browser. To change the built-in example data, edit `getDefaultBrands()` and `getDefaultState()` in `market-share.html`; the studio does not use `data.csv`. Switching browsers or clearing site data may erase saved edits, so back up important input separately.

## Local preview

If you double-click `index.html`, your browser may block the Sales Tracking tab from reading the local `data.csv`. The page then offers 「手动选择 CSV」 (Choose CSV manually). To load all three tabs reliably, run a local server from the project folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

In the repository, go to Settings → Pages, set Source to `Deploy from a branch`, choose the `master` branch and the `/ (root)` folder.

## Files

```
├── index.html           Three-tab homepage and sales tracker
├── market-share.html    Market-share charts and poster exporter
├── sales-estimator.html Bar-length ranking estimator and poster studio
├── data.csv             Sales-tracking data (not used by the other tabs)
├── README.md         Chinese README
└── README.en.md      English README
```

## Technical notes

- Sales-tracking charts use [Apache ECharts](https://echarts.apache.org/) 5.4.3, loaded from cdnjs.
- The market-share poster is rendered in native SVG and exported through Canvas; its editor uses the Tailwind CSS CDN and runs separately from the sales tracker.
- Fonts are Noto Sans SC and IBM Plex Mono from Google Fonts. If they fail to load, the page falls back to system fonts and still works.
- The Sales Tracking page follows the system's light/dark preference by default; the 🌙 / ☀️ button switches it manually and saves the choice locally. The Market Share studio has six independent poster palettes.
- The tabs run in separate documents. Sales Tracking saved lists and Market Share editor settings have separate browser storage; ranking estimates and text edits apply to the estimator page's current session.
- The interface is in Chinese.

## Design decisions

These rules were settled after several rounds of changes. Please keep them when editing the code:

- **No legend.** On desktop, names are written at the line ends. On phones, the line ends carry numbers and the names go in a list below the chart, so they don't take width from the x-axis.
- **Brand names.** When every model shown belongs to one brand, the brand is left out; it is written only when brands are mixed. Exception: model names that start with a digit or are 3 characters or shorter (such as `15`, `600系列`, `Win`, `K90`) can't be recognised on their own and can clash with other brands, so they always include the brand. In the phone list, a full name that doesn't fit drops the brand first (except for those names) and is truncated only after that. The model buttons in the 「全部」 (All) view always include the brand.
- **The values are called 累计销量 (cumulative sales).** The CSV holds cumulative figures, so the page does not call them "raw values" or "weekly sales".
- **The "latest week" for milestones is per brand**: it is the last week that brand's data reaches, compared with the week before. That way a brand whose newest week hasn't been entered yet still shows its milestones from the week before.
- **Default selection in 「全部」 (All)**: each brand's model with the largest gain in the latest week. Models whose data reaches a more recent week come first (models no longer updated rank lower); within the same week, the larger gain wins.
- **In exports, lines without a name or number are drawn as thin light-grey lines**, meaning only "other models", and their count is noted: at the bottom of the desktop export, at the end of the list in the mobile export.
- **The phone page matches the mobile export.** There are only two differences: the on-page list is a single column with every model, while the export has at most two columns and 12 items; the page can show data labels, the export never does.
- **Mobile export.** Designed at 400px wide and exported at 3×; text is at least 12px at phone width; lines are 2px, 3px when highlighted; the background is opaque and follows the page's light or dark theme.
- **Values in the phone list are rounded to integers.** Data labels on the chart keep up to two decimals.
- **Data points are not drawn when more than 12 lines are shown.**
- **Chart zoom is off on touch devices** (where the main input is a finger), so swiping over the chart still scrolls the page.
- **Chinese text uses Noto Sans SC; numbers use IBM Plex Mono.** The chart is laid out again once the fonts finish loading.
- **Colours follow brand families**: Xiaomi and REDMI orange; Huawei and Honor red; OPPO and OnePlus green; vivo and iQOO blue; Apple purple. The two brands in a family are offset slightly in hue, and models within a brand use different shades. A new brand needs a line in `BRAND_HUE` in `index.html`; otherwise it uses the generic palette.
- **The data table puts the latest week on the left.** Column order: model → launch date → latest week → the week before → … → earliest week, so the newest figures are seen first. This order holds when switching the x-axis (calendar week / week N after launch) and the values (cumulative / week-over-week change); in the "week N after launch" view, the largest N is leftmost. The chart's x-axis still runs from earliest to latest.
- **PNG export file names**: `新机周销量-<list or brand>-<x-axis>-<y-axis>-<桌面/手机>.png`, for example `新机周销量-华为-自然-总销量-桌面.png` or `新机周销量-本周里程碑-发布后-周增量-手机.png`.
  - When a saved list is selected (a user list or 「本周里程碑」), its name is used instead of the brand; otherwise the current brand is used (which may be 「全部」).
  - The x-axis part is 「自然」 (calendar week) or 「发布后」 (after launch); the y-axis part is 「总销量」 (cumulative) or 「周增量」 (weekly change); the last part is 「桌面」 (desktop) or 「手机」 (mobile), telling the two export buttons apart.
  - The week range is not included. Characters not allowed in file names (`\ / : * ? " < > |`) in a list name are replaced with `_`.

## Note

GitHub Pages content is public. Check that both the `data.csv` figures and any market-share poster data you publish may be shared. The Sales Tracking dataset is a selected sample of models, **not a complete market-wide ranking**. The Market Share studio's built-in numbers are examples, not official or live figures.

## Special thanks

Thanks to [@zhoulin12138](https://github.com/zhoulin12138) for the ideas, guidance and support that went into this project.
