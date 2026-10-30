# Smartphone Weekly Sell-Out Tracker · smartphoneSellOut

[简体中文](README.md) | English

A purely static web page that plots the weekly sell-out (SO, in units of 10,000 phones, shown on the page as 万台) of newly launched smartphones in China, broken down by brand and model. All data lives in `data.csv`, which the page reads automatically when it opens. There is no backend and no build step.

Live site: <https://muinocriz.github.io/smartphoneSellOut/>

## Data sources

- Primary source: Weibo blogger **RD观测** (RD Observation)
- Secondary source: Weibo blogger **数码闲聊站** (Digital Chat Station)

The author compiled and entered the figures by hand from these bloggers' public posts. They are for personal study and reference only and are not official data. All rights to the data belong to the original authors.

## Features

- **Brand / model filter**: pick a brand, then select any number of its models. Choose 「全部」 (All) to compare across brands.
- **Data labels**: every point on a line shows its value. Overlapping labels are hidden automatically, and you can turn all labels off.
- **Week range**: drag the slider under the chart, use the start/end week dropdowns, or scroll the mouse wheel over the chart to change which weeks are shown.
- **Two x-axis modes**:
  - Calendar week: weeks in order (W34, W35, …).
  - Week N after launch: the week containing the launch date counts as week 1, so you can compare models that launched at different times.
- **Two value modes**: raw values, or week-over-week change (this week minus last week).
- **Log y-axis**: useful when models differ greatly in scale, for example iPhone alongside other models.
- **Data table**: the values for the selected models are listed below the chart.
- **Anomaly hints**: if a model's value is lower than the week before, the page flags it as a possible data-entry error.
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
| `model` | Model. Required. Must be unique within a brand |
| `category` | Category. Optional; shown when you hover over a model |
| `date` | Launch date. Required. `2026/5/9` or `2026-05-09` |
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

## Note

Anyone can view a GitHub Pages site, even if the repository is private. Make sure the data in `data.csv` is fine to make public.
