# smartphoneSellOut · Smartphone Sales Visualizations

[简体中文](README.md) · [English](README.en.md)

A smartphone data dashboard and social-poster toolkit deployed on Cloudflare Workers, with three independent modules. The frontend uses static HTML/CSS/JS and requires no local build; the production Worker enforces access control.

**[Open the live project](https://smartphonesellout.zirconium.workers.dev/)**

<p align="center">
  <img src="screenshots/新机周销量-26折叠-发布后-总销量-桌面.png" alt="Desktop sales-tracking preview" width="760">
</p>

## Modules

| Module | What it does | Open |
| --- | --- | --- |
| **01 · Sales Tracking** | Explore cumulative sales, weekly changes and full ISO sales-week trends; default to recent 12-week launches, filter models, save custom lists and export desktop/mobile PNGs. | [Sales Tracking](https://smartphonesellout.zirconium.workers.dev/) |
| **02 · Market Share** | Auto-load weekly brand shares from `market-share.csv`; compare adjacent ISO weeks, import a local CSV, manually edit values, and export five chart types (including market-scale stacked charts) in six themes as high-resolution 3:4 PNGs. | [Market Share](https://smartphonesellout.zirconium.workers.dev/#market-share) |
| **03 · Ranking Estimator & Poster Studio** | Calibrate ranking screenshots against known sales or create posters directly from archived rankings and ten research topics; merge CSV history and export high-resolution 3:4/9:16 PNGs and ZIP bundles. | [Ranking Estimator](https://smartphonesellout.zirconium.workers.dev/#sales-estimator) |

## Getting started

Use the live site above (modules 1 and 2 are public; module 3 requires authorization). Maintainers with private repository access can download or clone it and serve it locally:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Opening `index.html` directly as a local file may block reading `data.csv`; a local web server is recommended.

## Updating data

Each module uses a separate CSV with a distinct statistical definition. Commit the corresponding CSV to the repository root to publish permanent data updates.

- **Module 1:** Edit `data.csv` in the repository root. Figures are **cumulative sales in units of 10,000 phones**; weekly sales are derived from adjacent cumulative values. Add a week by appending a column.
- **Module 2:** Append one row of shares and market trend per ISO week to `market-share.csv`. OPPO includes OnePlus and realme; vivo includes iQOO. Do not double-count subbrands. The page auto-loads the CSV and supports local import, historical weeks and manual edits.
- **Module 3:** Import a ranking screenshot from the left panel, enter model names and the period, and calibrate with known sales for the **same period and definition**. Export the merged full history and commit the downloaded `sales-estimates.csv`. Rankings of different sizes need no zero padding; back up uncommitted data before refreshing. Select an archived ranking to create posters without recalibration. Only final estimates are archived, not the original screenshot or full calibration workspace.

Both poster studios offer four PNG export resolutions, defaulting to 2160px wide. With safe-area avoidance enabled, both studios can export safe-area and full-layout variants (default right margin 13%, bottom 10%). Module 3 presents estimated sales to one decimal place in units of 10,000 phones, retaining CSV precision.

For the full CSV schema, full-sales-week definitions, poster specifications, design principles, deployment details and implementation notes, see the [Maintenance & Design Guide (Chinese)](docs/MAINTAINER_GUIDE.md).

## Sources and data limitations

Sales-tracking data is manually compiled mainly from public posts by **RD观测** and **数码闲聊站**. It is for reference and personal study, not official reporting. **Module 1 contains a selected model sample, not a market-wide ranking; Module 2 auto-loads an editable market-share CSV (non-official estimates) and reports load failures with a local CSV import option; no built-in sample shares remain; Module 3 describes only the listed models in the corresponding ranking period, not total brand market share.** Verify dates, definitions and underlying data before publication.

## Cloudflare deployment

Production hosting has migrated to Cloudflare Workers. The source repository is private, and the maintainer has disabled the former GitHub Pages site. Modules 1 and 2 are public, including `data.csv` and `market-share.csv`. Module 3 requires Cloudflare Access authorization via an approved email and one-time PIN. Its page, historical CSV and derived datasets live under `/studio/`, with server-side Access JWT verification by the Worker. Module 2 assets are served at the root; the build retains compatible copies under `/studio/` for cross-module research. Only allowlisted assets are deployed; the private repository's `master` branch remains the deployment source. See the [deployment guide (Chinese)](docs/CLOUDFLARE_DEPLOYMENT.md) for validation scope and maintenance requirements. Local development does not enforce Access.

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — feature history and fixes.
- [Maintenance & Design Guide (Chinese)](docs/MAINTAINER_GUIDE.md) — data schema, visual rules and technical maintenance.
- [Module 3 Architecture (Chinese)](docs/MODULE3_ARCHITECTURE.md) — research engine, preferences, initialization isolation and generated datasets.

**Acknowledgement:** Thanks to [@zhoulin12138](https://github.com/zhoulin12138) for ideas, guidance and support.
