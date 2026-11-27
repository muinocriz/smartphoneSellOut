// index.html is only the home/legacy redirect; data.csv remains a public import source for the Sales Data Editor.
export const publicFiles=Object.freeze([
 'index.html','favicon-adaptive.svg','site-shell.css','data.csv','studio-ui.css','iso-sales-week.js','sales-chart-layout.js',
 // The Sales Data Editor is public; publish the shared model master and tracked sales at root as explicitly requested.
 'sales-increment.html','sales-increment.js','sales-data-editor.html','weibo-sales-parser.js','weibo-market-parser.js','model-master.csv','sales-long.csv',
 // Keep public market data and shared assets; Popular Models and Ranking Research also needs its local /studio/ copies.
 'market-share.csv','market-share-data.js',
 'poster-themes.js','poster-watermark.js','poster-export.js','brand-utils.js'
]);
export const studioFiles=Object.freeze([
 'market-share.csv','market-share-data.js',
 'sales-estimator.html','sales-estimates.csv','model-master.csv','model-master.js','sales-long.csv','sales-tracking.js','sales-fusion.js','product-research.js','sales-estimate-archive.js','poster-themes.js','poster-watermark.js','poster-export.js','studio-ui.css','iso-sales-week.js','brand-utils.js',
 'sales-series.js','studio-preferences.js','sales-chart-layout.js','poster-typography.js','research-charts.js','sales-poster.js','sales-estimator.js','sales-studio.js'
]);
