'use strict';
// Run from the repository root: node tests/poster-theme-consistency.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../poster-themes.js');
const themes = globalThis.PosterThemes;
const root = path.join(__dirname, '..');
const market = fs.readFileSync(path.join(root, 'market-share.html'), 'utf8');
const estimator = fs.readFileSync(path.join(root, 'sales-estimator.html'), 'utf8');
const aliases = {
  lilac: 'lilac_cloud',
  editorial: 'editorial_paper',
  pure: 'pure_white',
  mist: 'mist_minimal',
  coral: 'coral_sunset',
  olive: 'morandi_sage'
};
assert.equal(Object.keys(themes.palettes).length, 6);
assert.equal(Object.keys(themes.estimatorPalettes).length, 6);

for (const [alias,id] of Object.entries(aliases)) {
  const marketTheme = themes.market(id);
  const estimatorTheme = themes.estimator(alias);
  assert.equal(marketTheme.name,estimatorTheme.name,alias+' theme name');
  assert.equal(marketTheme.bgTop,estimatorTheme.bgTop,alias+' exterior start');
  assert.equal(marketTheme.bgBottom,estimatorTheme.bgBottom,alias+' exterior end');
  assert.equal(marketTheme.cardBg,'#ffffff',alias+' white surface');
  assert.equal(estimatorTheme.panel,'#ffffff',alias+' canvas white surface');
  assert.equal(marketTheme.cardBorder,estimatorTheme.hair,alias+' outline');
  assert.equal(marketTheme.gridLine,estimatorTheme.track,alias+' progress track');
  assert.equal(marketTheme.textPrimary,estimatorTheme.ink,alias+' primary text');
  assert.equal(marketTheme.textSecondary,estimatorTheme.sub,alias+' secondary text');
  assert.equal(marketTheme.upColor,estimatorTheme.accent,alias+' primary emphasis');
  assert.equal(marketTheme.upColor,estimatorTheme.bar2,alias+' leader emphasis');
  assert.equal(marketTheme.downColor,estimatorTheme.bar,alias+' supporting bars');
  assert.deepEqual(themes.swatches(alias),marketTheme.swatches,alias+' UI swatches');
}
assert.ok(market.includes('<script src="poster-themes.js"></script>'));
assert.ok(estimator.includes('<script src="poster-themes.js"></script>'));
assert.ok(market.includes('const PALETTES = window.PosterThemes.palettes;'));
assert.ok(estimator.includes('const socialPalettes=window.PosterThemes.estimatorPalettes;'));
assert.ok(!market.includes('const PALETTES = {'));
assert.ok(!estimator.includes('const socialPalettes={'));
assert.ok(market.includes("paletteId: 'editorial_paper'"));
assert.ok(estimator.includes("theme:'editorial'"));
assert.ok(market.includes("fill:'url(#posterBgGrad)'"));
assert.ok(market.includes("fill:'#ffffff',filter:'url(#posterMainCardShadow)'"));
assert.ok(estimator.includes('gradient.addColorStop(0,p.bgTop)'));
assert.ok(estimator.includes('gradient.addColorStop(1,p.bgBottom)'));
assert.ok(estimator.includes("rounded(ctx,x,y,w,h,r,'#ffffff')"));
assert.ok(estimator.includes('drawDataCard(ctx,cardX,cardY,cardW,cardH,p)'));
assert.ok(estimator.includes('drawDataCard(ctx,52,338,976,H-538,p)'));
assert.ok(estimator.includes('drawDataCard(ctx,x,y,457,panelH,p)'));
assert.ok(estimator.includes('drawImageWatermark(ctx,W,H,right,bottom);'));
assert.ok(market.includes('renderImageWatermark(svg,W,H,safeRightX,safeBottomY);'));
console.log('Shared poster themes: 6 palettes and SVG/Canvas visual roles OK.');
