# smartphoneSellOut · Smartphone Sales Visualizations

[简体中文](README.md) · [English](README.en.md)

A static, **no-backend and no-build** smartphone data dashboard and social-poster toolkit, published on GitHub Pages. It has three independent modules.

**[Open the live project](https://muinocriz.github.io/smartphoneSellOut/)**

<p align="center">
  <img src="screenshots/新机周销量-26折叠-发布后-总销量-桌面.png" alt="Desktop sales-tracking preview" width="760">
</p>

## Modules

| Module | What it does | Open |
| --- | --- | --- |
| **01 · Sales Tracking** | Explore selected models' cumulative sales, weekly changes, charts and data tables; filter and save lists, export desktop/mobile PNGs. | [Sales Tracking](https://muinocriz.github.io/smartphoneSellOut/) |
| **02 · Market Share** | Compare two weeks of brand shares, create five chart types, customize six palettes, captions and watermarks; export 3:4 PNGs. | [Market Share](https://muinocriz.github.io/smartphoneSellOut/#market-share) |
| **03 · Ranking Estimator & Poster Studio** | Calibrate TOP30/TOP40 screenshot bar lengths against known sales, estimate listed models' volumes, and export posters, CSV and ZIP. | [Ranking Estimator](https://muinocriz.github.io/smartphoneSellOut/#sales-estimator) |

## Getting started

Use the live site above, or download/clone this repository and serve it locally:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Opening `index.html` directly as a local file may block reading `data.csv`; a local web server is recommended.

## Updating data

- **Module 1:** Edit `data.csv` in the repository root. Figures are **cumulative sales in units of 10,000 phones**; weekly sales are derived from adjacent cumulative values. Add a week by appending a column.
- **Module 2:** Edit weekly shares and report copy in the web interface. Browser-local edits are separate from `data.csv`.
- **Module 3:** Import a ranking screenshot and supply known sales from the **same period and definition** for calibration. Each ranking is handled independently and does not read `data.csv`.

For the full CSV schema, poster specifications, design principles, deployment details and implementation notes, see the [Maintenance & Design Guide (Chinese)](docs/MAINTAINER_GUIDE.md).

## Sources and data limitations

Sales-tracking data is manually compiled mainly from public posts by **RD观测** and **数码闲聊站**. It is for reference and personal study, not official reporting. **Module 1 contains a selected model sample, not a market-wide ranking; Module 2 starts with editable sample shares; Module 3 describes only models present in the supplied screenshot, not total brand market share.** Verify dates, definitions and underlying data before publication.

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — feature history and fixes.
- [Maintenance & Design Guide (Chinese)](docs/MAINTAINER_GUIDE.md) — data schema, visual rules and technical maintenance.

**Acknowledgement:** Thanks to [@zhoulin12138](https://github.com/zhoulin12138) for ideas, guidance and support.
