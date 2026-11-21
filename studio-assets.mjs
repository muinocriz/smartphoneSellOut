// Only explicitly listed resources are deployed or accessible. Auth behavior stays in Worker.
export const publicFiles=Object.freeze([
 'data.csv','studio-ui.css','iso-sales-week.js',
 // Module 2 is public; shared dependencies are also copied under /studio/ for Module 3.
 'market-share.html','market-share.csv','market-share-data.js','market-share-import.js','market-share.css',
 'poster-themes.js','poster-watermark.js','poster-export.js','brand-utils.js'
]);
export const protectedFiles=Object.freeze([
 'market-share.html','market-share.csv','market-share-data.js','market-share-import.js','market-share.css',
 'sales-estimator.html','sales-estimates.csv','model-master.csv','model-master.js','product-research.js','sales-estimate-archive.js','poster-themes.js','poster-watermark.js','poster-export.js','studio-ui.css','iso-sales-week.js','brand-utils.js',
 'sales-series.js','studio-preferences.js','research-charts.js','sales-poster.js','sales-estimator.js','sales-studio.js'
]);
export const generatedFiles=Object.freeze(['weekly-sales-panel.csv','weekly-sales-panel.meta.json']);
export const publicPaths=new Set(['/index.html',...publicFiles.map(f=>'/'+f)]);
export const studioPaths=new Set([...protectedFiles,...generatedFiles].map(f=>'/studio/'+f));
