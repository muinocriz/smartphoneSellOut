# Smartphone Weekly Sell-Out Tracker · smartphoneSellOut

[简体中文](README.md) | English

A purely static web page that plots the weekly sell-out (SO, in units of 10,000 phones, shown on the page as 万台) of newly launched smartphones in China, broken down by brand and model. All data lives in `data.csv`, which the page reads automatically when it opens. There is no backend and no build step.

Live site: <https://muinocriz.github.io/smartphoneSellOut/>

## Data sources

- Primary source: Weibo blogger **RD观测** (RD Observation)
- Secondary source: Weibo blogger **数码闲聊站** (Digital Chat Station)

The author compiled and entered the figures by hand from these bloggers' public posts. They are for personal study and reference only and are not official data. All rights to the data belong to the original authors.

## Features

- **Brand / model filter**: pick a brand, then select any number of its models. Choose 「全部」 (All) to compare across brands; it starts with each brand's model with the largest gain in the latest week.
- **Names at line ends**: there is no legend. Each line's model name is written at its end, in the line's colour. Names avoid other lines and value labels automatically; names that don't fit are shown faded, and hovering the line reveals them.
- **Data labels**: every point on a line shows its value. Overlapping labels are hidden automatically, and you can turn all labels off. They are off by default on phones.
- **PNG export**: two buttons at the top right of the chart export the currently selected models and week range.
  - 🖥️ Desktop: 16:9, 2400×1350.
  - 📱 Mobile: 4:5 portrait, 1200×1500, with numbers at the line ends and a list below the chart ranked by latest value.
  - Lines with no room for a name or number are drawn in light grey, and their count is noted.
- **Phone layout**: on screens up to 600px wide, the on-page chart uses the same style as the mobile export. Tap a list item to highlight its line.
- **Week range**: drag the slider under the chart, use the start/end week dropdowns, or scroll the mouse wheel over the chart to change which weeks are shown.
- **Two x-axis modes**:
  - Calendar week: weeks in order (W34, W35, …).
  - Week N after launch: the week containing the launch date counts as week 1, so you can compare models that launched at different times.
- **Two value modes**: cumulative sales (累计销量), or week-over-week change (this week minus last week).
- **Log y-axis**: useful when models differ greatly in scale, for example iPhone alongside other models.
- **Data table**: the values for the selected models are listed below the chart, with columns matching the chart's x-axis.
- **Anomaly hints**: if a model's value is lower than the week before, the page flags it as a possible data-entry error. Models without a launch date are left out of the "week N after launch" view, and the page lists their names.
- **Saved lists (我的列表)**: save a set of models you often check as a template and restore it with one click.
  - New lists are named 「用户列表1」, 「用户列表2」, … (User list 1, 2, …), and you can rename them directly.
  - You can update a list's models or delete the list (deleting takes a second click to confirm).
  - Lists are stored in this browser's localStorage. They are not available on another device or browser, or after the browser's site data is cleared. Use the Export / Import buttons (导出 / 导入) to save lists as a JSON file for backup or to move them to another browser.

## Updating the data

Edit `data.csv` and commit. GitHub Pages updates within a minute or two. You don't need to change `index.html`.

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

## Local preview

If you open `index.html` by double-clicking it, the browser blocks the page from reading the local `data.csv`. The page then shows a 「手动选择 CSV」 (Choose CSV manually) option; pick the file and the chart loads. Alternatively, run a local server in the project folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment

In the repository, go to Settings → Pages, set Source to `Deploy from a branch`, choose the `master` branch and the `/ (root)` folder.

## Files

```
├── index.html     The page itself (styles and scripts are in this one file)
├── data.csv       Sell-out data
├── README.md      Chinese README
└── README.en.md   English README
```

## Technical notes

- Charts use [Apache ECharts](https://echarts.apache.org/) 5.4.3, loaded from cdnjs.
- Fonts are Noto Sans SC and IBM Plex Mono from Google Fonts. If they fail to load, the page falls back to system fonts and still works.
- The page follows the system's light / dark theme and works on phones.
- The interface is in Chinese.

## Design decisions

These rules were settled after several rounds of changes. Please keep them when editing the code:

- **No legend.** On desktop, names are written at the line ends. On phones, the line ends carry numbers and the names go in a list below the chart, so they don't take width from the x-axis.
- **Brand names.** When every model shown belongs to one brand, the brand is left out; it is written only when brands are mixed. Exception: model names that start with a digit or are 3 characters or shorter (such as `15`, `600系列`, `Win`, `K90`) can't be recognised on their own and can clash with other brands, so they always include the brand. In the phone list, a full name that doesn't fit drops the brand first (except for those names) and is truncated only after that. The model buttons in the 「全部」 (All) view always include the brand.
- **The values are called 累计销量 (cumulative sales).** The CSV holds cumulative figures, so the page does not call them "raw values" or "weekly sales".
- **Default selection in 「全部」 (All)**: each brand's model with the largest gain in the latest week. Models whose data reaches a more recent week come first (models no longer updated rank lower); within the same week, the larger gain wins.
- **In exports, lines without a name or number are drawn as thin light-grey lines**, meaning only "other models", and their count is noted: at the bottom of the desktop export, at the end of the list in the mobile export.
- **The phone page matches the mobile export.** There are only two differences: the on-page list is a single column with every model, while the export has at most two columns and 12 items; the page can show data labels, the export never does.
- **Mobile export.** Designed at 400px wide and exported at 3×; text is at least 12px at phone width; lines are 2px, 3px when highlighted; the background is opaque and follows the page's light or dark theme.
- **Values in the phone list are rounded to integers.** Data labels on the chart keep up to two decimals.
- **Data points are not drawn when more than 12 lines are shown.**
- **Chinese text uses Noto Sans SC; numbers use IBM Plex Mono.** The chart is laid out again once the fonts finish loading.
- **Colours follow brand families**: Xiaomi and REDMI orange; Huawei and Honor red; OPPO and OnePlus green; vivo and iQOO blue; Apple purple. The two brands in a family are offset slightly in hue, and models within a brand use different shades. A new brand needs a line in `BRAND_HUE` in `index.html`; otherwise it uses the generic palette.

## Note

Anyone can view a GitHub Pages site, even if the repository is private. Make sure the data in `data.csv` is fine to make public.

## Special thanks

Thanks to [@zhoulin12138](https://github.com/zhoulin12138) for the ideas, guidance and support that went into this project.
