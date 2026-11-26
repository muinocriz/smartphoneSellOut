# smartphoneSellOut · Smartphone Sales Visualizations

[简体中文](README.md) · [English](README.en.md)

A smartphone data dashboard and social-poster toolkit deployed on Cloudflare Workers, with three independent modules. The frontend uses static HTML/CSS/JS and requires no local build; the Worker serves the published assets.

**[Open the live project](https://smartphonesellout.zirconium.workers.dev/)**

<p align="center">
  <img src="screenshots/新机周销量-26折叠-发布后-总销量-桌面.png" alt="Historical sales chart example" width="760">
</p>

## Modules

| Module | What it does | Open |
| --- | --- | --- |
| **Sales Increment Tracker** | Track weekly changes from the long-format sales data, compare models by calendar or full sales week, estimate bounded gaps, edit observations and export PNG or CSV. | [Open tracker](https://smartphonesellout.zirconium.workers.dev/sales-increment.html) |
| **Sales Data Editor** | Auto-load project sales and model CSVs; edit cumulative and weekly values, manage special observations and model metadata, check data, save local drafts and export CSVs. | [Sales Data Editor](https://smartphonesellout.zirconium.workers.dev/sales-data-editor.html) |
| **Popular Models and Ranking Research** | Calibrate ranking screenshots against known sales or create posters directly from archived rankings and fourteen research topics; track sales and original ranks together, view rank matrices, merge CSV history and export high-resolution 3:4/9:16 PNGs and ZIP bundles. | [Ranking Estimator](https://smartphonesellout.zirconium.workers.dev/studio/sales-estimator.html) |

The in-list and whole-market brand competition study adds a six-brand, three-row by two-column growth-decomposition view (listed and off-list week-over-week changes, plus total changes), and retains a two-week ribbon comparison and a multiweek stacked-flow mode, with translucent same-brand ribbons drawn only between adjacent valid weeks. The TOP30 market coverage study now combines market-size estimates and a 100% rank-layer composition chart; off-list shares are conditional scenario residuals, left blank without a feasible finite market interval. The ranking-ecosystem brand-structure multiweek stacked chart now also uses these ribbons for brand sales share, model-count share, and sales volume; missing weeks break the connections, and the multiweek cross-module view omits the pp-change column.

## Getting started

Use the live site above (all three modules are public; the home page opens the Sales Increment Tracker). Maintainers with private repository access can download or clone it and serve it locally:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Opening `index.html` directly as a local file redirects to the Sales Increment Tracker and may block reading local CSV files; a local web server is recommended.

## Updating data

The Legacy Sales Tracking page has been retired; its original wide CSV remains available for Sales Data Editor. Popular Models and Ranking Research optionally combines tracked sales with ranking estimates; Sales Data Editor edits local copies and exports CSVs without writing to the repository. Commit the corresponding CSV to the repository root to publish permanent data updates.

- **Cumulative wide CSV:** Keep `data.csv` in the repository root. Figures are **cumulative sales in units of 10,000 phones**; Sales Data Editor supports manual incremental synchronization. Add a week by appending a column.
- **Whole-market share data (for Popular Models and Ranking Research):** Append one row of shares and market trend per ISO week to `market-share.csv`. OPPO includes OnePlus and realme; vivo includes iQOO. Do not double-count subbrands. Popular Models and Ranking Research reads the repository CSV directly; the standalone market-share page has been retired.
- **Popular Models and Ranking Research:** Import a ranking screenshot from the left panel, enter model names and the period, and calibrate with known sales for the **same period and definition**. Export the merged full history and commit the downloaded `sales-estimates.csv`. Rankings of different sizes need no zero padding; back up uncommitted data before refreshing. Select an archived ranking to create posters without recalibration. Only final estimates are archived, not the original screenshot or full calibration workspace. The `model-master.csv` catalog (also public for Sales Data Editor) now powers permanent research sequence IDs, alias matching and automatic grouping. Unmatched models retain separate identities; price-band, brand-positioning, chipset, product-age and multidimensional research are available. All fourteen research topics also support direct chart PNG export using the current studio theme, watermark and export width, with adaptive chart geometry and no social safe-area clipping. Topic ZIPs include PNG, copy, headlines, complete analytical CSV, plotted-data CSV, methodology and a JSON manifest.

- **Sales Data Editor:** Automatically reads `sales-long.csv` and `model-master.csv` unless a local draft is restored. Reload the deployed project long table directly or import a local CSV. Export `sales-long.csv` and `model-master.csv` and commit them manually. The retained wide CSV can be maintained separately. Use the existing project long table as the baseline, select incremental sync from the deployed project wide CSV or a local cumulative wide CSV, review additions and exact-value conflicts, then export and commit the long table. Each applied sync supports undo/redo; the local wide CSV need not be uploaded first. There is no automatic or two-way synchronization.

The Popular Models and Ranking Research defaults to original ranking data; ten of fourteen research topics also support the shared expanded sample: exact weekly observations, reliable cumulative differences, then complete original TOP30 estimates as fallback. Overlapping coverage is deduplicated, combined entries are not split, and expanded mode does not interpolate. Original ranks, ranking persistence and flow, and cross-market studies retain original ranking definitions.


The Popular Models and Ranking Research offers four PNG export resolutions, defaulting to 2160px wide. With safe-area avoidance enabled, the studio can export safe-area and full-layout variants (default right margin 13%, bottom 10%). The Popular Models and Ranking Research presents estimated sales to one decimal place in units of 10,000 phones, retaining CSV precision.

The Popular Models and Ranking Research prioritizes mobile-readable 3:4 posters using a 360-unit logical design baseline, shared axis and legend typography, measured spacing, and adaptive stacked-chart and heatmap labels. See the [Maintenance & Design Guide (Chinese)](docs/MAINTAINER_GUIDE.md) for current design parameters and pending visual acceptance. Live research previews and exported posters retain distinct layout rules.

The Popular Models and Ranking Research uses parent-brand color families and distinct point markers, shared across sales and rank charts for the current selection. Original ranks are never imputed or recalculated after filtering. The studio supports independent chart headings, notes and footer edits, and returning to the source without resetting the publication.

For the full CSV schema, full-sales-week definitions, poster specifications, design principles, deployment details and implementation notes, see the [Maintenance & Design Guide (Chinese)](docs/MAINTAINER_GUIDE.md).

## Sources and data limitations

Sales-tracking data is manually compiled mainly from public posts by **RD观测** and **数码闲聊站**. It is for reference and personal study, not official reporting. **Tracked sales data contains a selected model sample, not a market-wide ranking; Popular Models and Ranking Research reads the maintained whole-market share CSV (non-official estimates) directly; Popular Models and Ranking Research's original sample describes the corresponding ranking; its expanded sample also includes deduplicated tracked sales. Neither represents the whole market. Sales Data Editor edits do not automatically update published data.** Verify dates, definitions and underlying data before publication.

## Cloudflare deployment

Cloudflare deploys the listed assets from the private repository's `master` branch. All three modules and their published CSV files are public. Popular Models and Ranking Research uses `/studio/`. See the [deployment guide](docs/CLOUDFLARE_DEPLOYMENT.md).

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — feature history and fixes.
- [Maintenance & Design Guide (Chinese)](docs/MAINTAINER_GUIDE.md) — data schema, visual rules and technical maintenance.
- [Popular Models and Ranking Research Architecture (Chinese)](docs/MODULE3_ARCHITECTURE.md) — research engine, preferences, initialization isolation and generated datasets.

**Acknowledgement:** Thanks to [@zhoulin12138](https://github.com/zhoulin12138) for ideas, guidance and support.


